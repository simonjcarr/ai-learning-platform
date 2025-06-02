import { NextRequest, NextResponse } from 'next/server';
import { requireMinRole } from '@/lib/auth';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { aiService } from '@/lib/ai-service';
import { auth } from '@clerk/nextjs/server';

export const maxDuration = 300; // Maximum function duration: 300 seconds

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; articleId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require editor role for course article suggestions
    await requireMinRole(Role.EDITOR);
    
    const { courseId, articleId } = await params;
    const { suggestionType, suggestionDetails } = await request.json();

    if (!suggestionType || !suggestionDetails) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get course article details
    const courseArticle = await prisma.courseArticle.findUnique({
      where: { articleId },
      include: {
        section: {
          include: {
            course: {
              select: {
                courseId: true,
                title: true,
              }
            }
          }
        }
      }
    });

    if (!courseArticle || courseArticle.section.course.courseId !== courseId) {
      return NextResponse.json({ error: 'Course article not found' }, { status: 404 });
    }

    // Call AI service for validation and content generation
    let aiValidation;
    const aiStartTime = Date.now();
    console.log(`Starting AI validation for course article ${articleId} (${courseArticle.contentHtml?.length || 0} chars)`);
    
    try {
      // Use the same AI validation as regular articles
      aiValidation = await aiService.validateArticleSuggestion(
        courseArticle.title,
        courseArticle.contentHtml || '',
        suggestionType,
        suggestionDetails,
        userId
      );
      
      const aiEndTime = Date.now();
      console.log(`AI validation completed in ${aiEndTime - aiStartTime}ms`);
    } catch (aiError) {
      console.error('AI service error:', aiError);
      
      // If AI validation fails, return error
      return NextResponse.json(
        { 
          error: 'AI validation temporarily unavailable. Please try again later.',
          success: false 
        },
        { status: 503 }
      );
    }

    // If AI validation is successful and provides updated content
    if (aiValidation.isValid === true && aiValidation.updatedContent && aiValidation.diff) {
      try {
        const updatedMarkdownFromAI = aiValidation.updatedContent;
        
        // Validate that the updated content is not empty
        if (!updatedMarkdownFromAI || updatedMarkdownFromAI.trim().length === 0) {
          throw new Error('AI returned empty content for the article update');
        }

        // Start a transaction to ensure data consistency
        const result = await prisma.$transaction(async (tx) => {
          // Create change history record for course article
          const changeHistory = await tx.courseArticleChangeHistory.create({
            data: {
              articleId: articleId,
              clerkUserId: userId,
              diff: aiValidation.diff,
              beforeContent: courseArticle.contentHtml || '',
              afterContent: updatedMarkdownFromAI,
              changeType: 'ai_suggestion',
              description: aiValidation.description || `Applied ${suggestionType}: ${suggestionDetails.substring(0, 100)}...`,
              suggestionType,
              suggestionDetails,
              isActive: true,
            },
          });
          
          // Update the course article with new content
          await tx.courseArticle.update({
            where: { articleId },
            data: {
              contentHtml: updatedMarkdownFromAI,
              isGenerated: true,
              generatedAt: courseArticle.generatedAt || new Date(),
            },
          });

          return { changeHistory };
        });

        console.log(`Course article ${articleId} successfully updated with AI suggestion and change history recorded.`);

        return NextResponse.json({
          success: true,
          message: 'Suggestion applied successfully. The article has been updated.',
          diff: aiValidation.diff,
          changeId: result.changeHistory.id,
        });
      } catch (dbUpdateError) {
        console.error(`DB Error: Failed to update course article ${articleId} with AI suggestion:`, dbUpdateError);
        
        return NextResponse.json(
          { 
            error: 'Failed to apply suggestion due to a system error. Please try again.',
            success: false
          },
          { status: 500 }
        );
      }
    } else {
      // AI validation failed
      return NextResponse.json({
        success: false,
        message: aiValidation.reason || 'The suggestion could not be validated by AI.',
      });
    }
  } catch (error) {
    console.error('Error processing course article suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to process suggestion', success: false },
      { status: 500 }
    );
  }
}