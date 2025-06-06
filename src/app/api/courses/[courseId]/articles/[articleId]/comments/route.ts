import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { generateText } from 'ai';
import { createProviderForModel, getModelForInteraction, trackAIInteraction } from '@/lib/ai-service';

// GET /api/courses/[courseId]/articles/[articleId]/comments
export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string; articleId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { courseId, articleId } = await params;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Verify the article exists and belongs to the course
    const article = await prisma.courseArticle.findFirst({
      where: {
        articleId,
        section: {
          courseId
        }
      }
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Get comments with replies
    const [comments, total] = await Promise.all([
      prisma.courseComment.findMany({
        where: {
          courseArticleId: articleId,
          parentId: null, // Only get top-level comments
        },
        include: {
          user: {
            select: {
              clerkUserId: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
            }
          },
          replies: {
            include: {
              user: {
                select: {
                  clerkUserId: true,
                  firstName: true,
                  lastName: true,
                  imageUrl: true,
                }
              }
            },
            orderBy: {
              createdAt: 'asc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.courseComment.count({
        where: {
          courseArticleId: articleId,
          parentId: null,
        }
      })
    ]);

    return NextResponse.json({
      comments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// POST /api/courses/[courseId]/articles/[articleId]/comments
export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string; articleId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { courseId, articleId } = await params;

    const body = await request.json();
    const { content, parentId } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify the article exists and belongs to the course
    const article = await prisma.courseArticle.findFirst({
      where: {
        articleId,
        section: {
          courseId
        }
      },
      include: {
        section: {
          include: {
            course: true
          }
        }
      }
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Verify parent comment exists if parentId is provided
    if (parentId) {
      const parentComment = await prisma.courseComment.findUnique({
        where: { commentId: parentId }
      });
      if (!parentComment || parentComment.courseArticleId !== articleId) {
        return NextResponse.json({ error: 'Invalid parent comment' }, { status: 400 });
      }
    }

    // Create the comment
    const comment = await prisma.courseComment.create({
      data: {
        courseArticleId: articleId,
        clerkUserId: userId,
        content,
        parentId,
      },
      include: {
        user: {
          select: {
            clerkUserId: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          }
        }
      }
    });

    // If this is a top-level comment (not a reply), analyze it with AI
    if (!parentId) {
      try {
        // Get AI configuration for comment analysis
        const analysisConfig = await getModelForInteraction('COURSE_COMMENT_ANALYSIS');
        const analysisModel = await createProviderForModel(analysisConfig.model.modelId);
        
        // Analyze the comment
        const analysisPrompt = `Analyze this comment on a course article titled "${article.title}":

Comment: "${content}"

Determine if this is a question about understanding the course material. 

IMPORTANT: Respond with ONLY a JSON object, no markdown formatting or code blocks:
{
  "isLearningQuestion": boolean,
  "confidence": number (0-1),
  "reason": "brief explanation"
}`;

        const startTime = new Date();
        const analysisResult = await generateText({
          model: analysisModel,
          prompt: analysisPrompt,
          temperature: 0.3,
          maxTokens: 200,
        });
        const endTime = new Date();

        // Track the analysis interaction
        await trackAIInteraction(
          analysisConfig.model.modelId,
          analysisConfig.interactionType.typeId,
          userId,
          analysisResult.usage?.promptTokens || 0,
          analysisResult.usage?.completionTokens || 0,
          startTime,
          endTime,
          {
            courseId,
            articleId,
            commentId: comment.commentId,
          },
          analysisPrompt,
          analysisResult.text
        );

        let isQuestion = false;
        try {
          // Clean the AI response - remove markdown code blocks if present
          let cleanedText = analysisResult.text.trim();
          if (cleanedText.startsWith('```json') && cleanedText.endsWith('```')) {
            cleanedText = cleanedText.slice(7, -3).trim();
          } else if (cleanedText.startsWith('```') && cleanedText.endsWith('```')) {
            cleanedText = cleanedText.slice(3, -3).trim();
          }
          
          const analysis = JSON.parse(cleanedText);
          isQuestion = analysis.isLearningQuestion && analysis.confidence > 0.7;
        } catch (e) {
          console.error('Failed to parse AI analysis:', e);
          console.error('Raw AI response:', analysisResult.text);
        }

        // Update comment with analysis result
        await prisma.courseComment.update({
          where: { commentId: comment.commentId },
          data: {
            aiAnalyzed: true,
            isQuestion,
          }
        });

        // If it's a learning question, generate a helpful reply
        if (isQuestion) {
          const replyConfig = await getModelForInteraction('COURSE_COMMENT_REPLY');
          const replyModel = await createProviderForModel(replyConfig.model.modelId);
          
          const replyPrompt = `A student has asked a question about the course article "${article.title}":

Student's question: "${content}"

Article description: "${article.description || 'No description available'}"

Provide a helpful, encouraging response that addresses their question and helps them understand the concept better.`;

          const replyStartTime = new Date();
          const replyResult = await generateText({
            model: replyModel,
            prompt: replyPrompt,
            temperature: 0.7,
            maxTokens: 500,
          });
          const replyEndTime = new Date();

          // Track the reply interaction
          await trackAIInteraction(
            replyConfig.model.modelId,
            replyConfig.interactionType.typeId,
            userId,
            replyResult.usage?.promptTokens || 0,
            replyResult.usage?.completionTokens || 0,
            replyStartTime,
            replyEndTime,
            {
              courseId,
              articleId,
              parentCommentId: comment.commentId,
            },
            replyPrompt,
            replyResult.text
          );

          // Create AI reply comment
          const aiReply = await prisma.courseComment.create({
            data: {
              courseArticleId: articleId,
              clerkUserId: 'ai-assistant', // Special ID for AI comments
              content: replyResult.text,
              parentId: comment.commentId,
            }
          });

          // Link the AI reply to the original comment
          await prisma.courseComment.update({
            where: { commentId: comment.commentId },
            data: { aiReplyId: aiReply.commentId }
          });
        }
      } catch (aiError) {
        console.error('AI analysis failed:', aiError);
        // Continue without AI analysis - don't fail the comment creation
      }
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}