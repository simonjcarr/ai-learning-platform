import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { checkFeatureAccessWithAdmin, checkFeatureUsageWithAdmin } from '@/lib/feature-access-admin';
import { generateText } from 'ai';
import { createProviderForModel, getModelForInteraction, trackAIInteraction } from '@/lib/ai-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; articleId: string }> }
) {
  const { userId } = await auth();
  const { courseId, articleId } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // For course articles, we need to create a dummy article record if it doesn't exist
    // This is a workaround for the foreign key constraint
    const courseArticleId = `course-${articleId}`;
    
    // Ensure the dummy article exists for the foreign key constraint
    await prisma.article.upsert({
      where: { articleId: courseArticleId },
      update: {},
      create: {
        articleId: courseArticleId,
        articleTitle: `Course Chat for Article ${articleId}`,
        articleSlug: `course-chat-${articleId}`,
        isContentGenerated: true,
        contentHtml: `<!-- Course chat placeholder for article ${articleId} -->`,
      },
    });
    
    const messages = await prisma.chatMessage.findMany({
      where: {
        articleId: courseArticleId,
        clerkUserId: userId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching course article chat messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat messages' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; articleId: string }> }
) {
  const { userId } = await auth();
  const { courseId, articleId } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check feature access for course AI chat (admins bypass all restrictions)
  const chatAccess = await checkFeatureAccessWithAdmin('course_ai_chat', userId);
  
  if (!chatAccess.hasAccess) {
    return NextResponse.json(
      { error: chatAccess.reason || 'Course AI chat requires a subscription upgrade' },
      { status: 403 }
    );
  }

  // Check usage limits for course AI chat (admins have unlimited access)
  const usageCheck = await checkFeatureUsageWithAdmin('daily_course_ai_chat_limit', userId, 'daily');
  
  if (!usageCheck.hasAccess) {
    return NextResponse.json(
      { 
        error: usageCheck.reason || `Daily chat limit reached (${usageCheck.currentUsage}/${usageCheck.limit}). Upgrade for more chats.`,
        currentUsage: usageCheck.currentUsage,
        limit: usageCheck.limit,
        remaining: usageCheck.remaining
      },
      { status: 429 }
    );
  }

  try {
    const { content, exampleId, context } = await req.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Fetch the course article with related data
    const courseArticle = await prisma.courseArticle.findUnique({
      where: { articleId },
      include: {
        section: {
          include: {
            course: {
              select: {
                courseId: true,
                title: true,
                description: true,
                level: true,
              }
            }
          }
        },
        quizzes: {
          include: {
            questions: true
          }
        }
      },
    });

    if (!courseArticle) {
      return NextResponse.json({ error: 'Course article not found' }, { status: 404 });
    }

    // Verify the article belongs to the requested course
    if (courseArticle.section.course.courseId !== courseId) {
      return NextResponse.json({ error: 'Article does not belong to this course' }, { status: 404 });
    }

    // Check if user is enrolled in the course
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        courseId_clerkUserId: {
          courseId,
          clerkUserId: userId,
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'You must be enrolled in this course to use AI chat' }, { status: 403 });
    }

    // Use a special articleId format for course articles to distinguish from regular articles
    const courseArticleId = `course-${articleId}`;

    // Ensure the dummy article exists for the foreign key constraint
    await prisma.article.upsert({
      where: { articleId: courseArticleId },
      update: {},
      create: {
        articleId: courseArticleId,
        articleTitle: `Course Chat for Article ${articleId}`,
        articleSlug: `course-chat-${articleId}`,
        isContentGenerated: true,
        contentHtml: `<!-- Course chat placeholder for article ${articleId} -->`,
      },
    });

    // Create the user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        articleId: courseArticleId,
        clerkUserId: userId,
        role: 'USER',
        content,
        exampleId,
      },
    });

    // Get previous chat history for context (last 10 messages)
    const previousMessages = await prisma.chatMessage.findMany({
      where: {
        articleId: courseArticleId,
        clerkUserId: userId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10,
    });

    // Build context for AI
    let aiContext = `Course: ${courseArticle.section.course.title}\n`;
    aiContext += `Course Level: ${courseArticle.section.course.level}\n`;
    aiContext += `Section: ${courseArticle.section.title}\n`;
    aiContext += `Article Title: ${courseArticle.title}\n\n`;
    
    if (courseArticle.contentHtml) {
      // Strip HTML tags for AI context
      const textContent = courseArticle.contentHtml.replace(/<[^>]*>/g, '');
      aiContext += `Article Content:\n${textContent.substring(0, 3000)}...\n\n`;
    }

    // If asking about a specific quiz question
    if (exampleId && context?.quizId) {
      const quiz = courseArticle.quizzes.find(q => q.quizId === context.quizId);
      if (quiz) {
        const question = quiz.questions.find(q => q.questionId === exampleId);
        if (question) {
          aiContext += `\nUser is asking about this course quiz question:\n`;
          aiContext += `Question: ${question.questionText}\n`;
          
          if (question.optionsJson) {
            const options = question.optionsJson as any[];
            aiContext += `Options:\n`;
            options.forEach((opt: any) => {
              aiContext += `- ${opt.text}\n`;
            });
          }
          
          aiContext += `\nCorrect Answer Explanation: ${question.explanation || 'See course content for explanation'}\n`;
        }
      }
    }

    // Build messages for AI
    const messages: any[] = [
      {
        role: 'system',
        content: `You are an AI tutor helping a student with a course article in an IT/Linux learning platform. 
Your role is to:
1. Answer questions about the course content clearly and concisely
2. Help explain course concepts and guide students through the learning material
3. Help with course quiz questions by guiding students to understand concepts rather than giving direct answers
4. Provide additional context and examples when helpful, keeping them relevant to the course level
5. Help students understand how this article fits into the broader course structure
6. Be encouraging and supportive of their learning journey
7. Never directly give away quiz answers - instead guide the student to understand the concept

Context about the course article:
${aiContext}`,
      },
    ];

    // Add previous conversation history (excluding the just-created user message)
    previousMessages.slice(0, -1).forEach(msg => {
      messages.push({
        role: msg.role.toLowerCase(),
        content: msg.content,
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content,
    });

    // Get AI response using new tracking system
    const startTime = new Date();
    let aiResponseContent;
    
    try {
      const { model, interactionType } = await getModelForInteraction('course_chat');
      const aiModel = await createProviderForModel(model.modelId);
      
      // Convert messages to the format needed by generateText
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');
      
      const result = await generateText({
        model: aiModel,
        system: systemMessage?.content,
        messages: conversationMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        })),
        temperature: 0.7,
        maxTokens: 500,
      });
      
      aiResponseContent = result.text;
      const endTime = new Date();
      
      // Track the interaction
      await trackAIInteraction(
        model.modelId,
        interactionType.typeId,
        userId,
        result.usage?.promptTokens || 0,
        result.usage?.completionTokens || 0,
        startTime,
        endTime,
        { courseId, articleId, exampleId, messageCount: messages.length },
        content, // User's question
        aiResponseContent
      );
      
    } catch (error) {
      console.error('Course AI chat error:', error);
      aiResponseContent = 'I apologize, but I was unable to generate a response.';
      
      const endTime = new Date();
      try {
        const { model, interactionType } = await getModelForInteraction('course_chat');
        await trackAIInteraction(
          model.modelId,
          interactionType.typeId,
          userId,
          0,
          0,
          startTime,
          endTime,
          { courseId, articleId, exampleId, error: true },
          content,
          undefined,
          String(error)
        );
      } catch (trackingError) {
        console.error('Failed to track course chat error:', trackingError);
      }
    }

    // Create the assistant message
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        articleId: courseArticleId,
        clerkUserId: userId,
        role: 'ASSISTANT',
        content: aiResponseContent,
        exampleId,
      },
    });

    return NextResponse.json({
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    console.error('Error creating course chat message:', error);
    return NextResponse.json(
      { error: 'Failed to create chat message' },
      { status: 500 }
    );
  }
}