import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { checkSubscription } from '@/lib/subscription-check';
import { aiService } from '@/lib/ai-service';

export const maxDuration = 300; // Maximum function duration: 300 seconds for Vercel Pro

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params in Next.js 15
    const { articleId } = await params;

    // Check subscription
    const subscription = await checkSubscription(userId);
    if (!subscription.isActive || subscription.tier === 'FREE') {
      return NextResponse.json(
        { error: 'Subscription required for suggestions' },
        { status: 403 }
      );
    }

    const { suggestionType, suggestionDetails } = await request.json();

    if (!suggestionType || !suggestionDetails) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get suggestion settings
    const settings = await prisma.suggestionSettings.findFirst();
    const rateLimitMinutes = settings?.rateLimitMinutes || 60;

    // Check rate limit
    const rateLimit = await prisma.suggestionRateLimit.findUnique({
      where: {
        clerkUserId_articleId: {
          clerkUserId: userId,
          articleId: articleId,
        },
      },
    });

    const now = new Date();
    const cooldownEnd = rateLimit
      ? new Date(rateLimit.lastSuggestionAt.getTime() + rateLimitMinutes * 60 * 1000)
      : null;

    if (cooldownEnd && now < cooldownEnd) {
      const remainingMinutes = Math.ceil((cooldownEnd.getTime() - now.getTime()) / 60000);
      return NextResponse.json(
        {
          error: `Please wait ${remainingMinutes} minutes before making another suggestion for this article`,
        },
        { status: 429 }
      );
    }

    // Get article details
    const article = await prisma.article.findUnique({
      where: { articleId: articleId },
      select: {
        articleId: true,
        articleTitle: true,
        contentHtml: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Call AI service for validation
    let aiValidation;
    const aiStartTime = Date.now();
    console.log(`Starting AI validation for article ${articleId} (${article.contentHtml?.length || 0} chars)`);
    
    try {
      aiValidation = await aiService.validateArticleSuggestion(
        article.articleTitle,
        article.contentHtml || '',
        suggestionType,
        suggestionDetails,
        userId
      );
      
      const aiEndTime = Date.now();
      console.log(`AI validation completed in ${aiEndTime - aiStartTime}ms`);
    } catch (aiError) {
      console.error('AI service error:', aiError);
      
      // If AI validation fails, create a suggestion record but don't auto-approve
      aiValidation = {
        isValid: false,
        reason: 'AI validation temporarily unavailable. Your suggestion has been recorded for manual review.',
        updatedContent: null
      };
    }

    // Variable to track if the article was successfully updated
    let articleUpdateSuccess = false;
    let articleUpdateError: string | null = null;

    // If AI validation is successful and provides updated content, update the article
    if (aiValidation.isValid === true && aiValidation.updatedContent) {
      try {
        const updatedMarkdownFromAI = aiValidation.updatedContent;
        
        // Validate that the updated content is not empty
        if (!updatedMarkdownFromAI || updatedMarkdownFromAI.trim().length === 0) {
          throw new Error('AI returned empty content for the article update');
        }
        
        // The field 'contentHtml' actually stores Markdown in this project
        await prisma.article.update({
          where: { articleId: articleId },
          data: {
            contentHtml: updatedMarkdownFromAI, // Update the field with new Markdown
          },
        });
        
        articleUpdateSuccess = true;
        console.log(`Article ${articleId} successfully updated with AI suggestion.`);
      } catch (dbUpdateError) {
        console.error(`DB Error: Failed to update article ${articleId} with AI suggestion:`, dbUpdateError);
        articleUpdateError = dbUpdateError instanceof Error ? dbUpdateError.message : 'Unknown error occurred';
        
        // Override the AI validation to reflect the failure
        aiValidation.isValid = false;
        aiValidation.reason = `The suggestion was valid but could not be applied due to a system error: ${articleUpdateError}. Your suggestion has been recorded for manual review.`;
      }
    }

    // Create suggestion record
    const suggestion = await prisma.articleSuggestion.create({
      data: {
        articleId: articleId,
        clerkUserId: userId,
        suggestionType,
        suggestionDetails,
        aiValidationResponse: JSON.stringify(aiValidation),
        isApproved: aiValidation.isValid === true,
        rejectionReason: aiValidation.isValid ? null : aiValidation.reason,
        processedAt: new Date(),
        aiInteractionId: null, // trackAIInteraction doesn't return the ID
      },
    });

    // Update rate limit
    await prisma.suggestionRateLimit.upsert({
      where: {
        clerkUserId_articleId: {
          clerkUserId: userId,
          articleId: articleId,
        },
      },
      update: { lastSuggestionAt: now },
      create: {
        clerkUserId: userId,
        articleId: articleId,
        lastSuggestionAt: now,
      },
    });

    // Check for badge achievements
    const approvedCount = await prisma.articleSuggestion.count({
      where: { clerkUserId: userId, isApproved: true },
    });

    const badges: string[] = [];
    // Assuming settings.badgeThresholds is a Prisma.JsonValue, 
    // which could be an object like { bronze?: number, silver?: number, gold?: number }
    if (settings?.badgeThresholds && typeof settings.badgeThresholds === 'object' && settings.badgeThresholds !== null) {
      const thresholds = settings.badgeThresholds as Record<string, unknown>; // Cast to a basic object
      if (typeof thresholds.bronze === 'number' && approvedCount >= thresholds.bronze) {
        badges.push('bronze');
      }
      if (typeof thresholds.silver === 'number' && approvedCount >= thresholds.silver) {
        badges.push('silver');
      }
      if (typeof thresholds.gold === 'number' && approvedCount >= thresholds.gold) {
        badges.push('gold');
      }
    }

    return NextResponse.json({
      success: true,
      suggestion: {
        suggestionId: suggestion.suggestionId,
        isApproved: suggestion.isApproved,
        rejectionReason: suggestion.rejectionReason,
        articleUpdated: suggestion.isApproved && articleUpdateSuccess,
      },
      approvedSuggestionsCount: approvedCount,
      badges,
    });
  } catch (error) {
    console.error('Error processing suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to process suggestion' },
      { status: 500 }
    );
  }
}