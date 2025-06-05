import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { checkFeatureAccessWithAdmin } from '@/lib/feature-access-admin';
import { addSuggestionToQueue } from '@/lib/bullmq';
import { callAI } from '@/lib/ai-service';

// Helper function to clean AI responses and remove JSON/technical details
function cleanAIResponse(response: string): string {
  if (!response) return response;
  
  // Remove JSON objects (anything between { and }) - handle nested braces
  let cleaned = response;
  let braceCount = 0;
  let inJson = false;
  let result = '';
  
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char === '{') {
      if (braceCount === 0) inJson = true;
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0) inJson = false;
    } else if (!inJson) {
      result += char;
    }
  }
  
  cleaned = result;
  
  // Remove any remaining JSON-like patterns
  cleaned = cleaned.replace(/\{.*?\}/gs, '');
  cleaned = cleaned.replace(/\[.*?\]/gs, '');
  
  // Remove RELEVANT: YES/NO from the display (keep it for logic but don't show to user)
  cleaned = cleaned.replace(/RELEVANT:\s*(YES|NO)/gi, '');
  
  // Remove technical markers and quotes
  cleaned = cleaned.replace(/```json.*?```/gs, '');
  cleaned = cleaned.replace(/```.*?```/gs, '');
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  
  // Remove any lines that start with technical markers
  cleaned = cleaned.replace(/^\s*["{[].*$/gm, '');
  cleaned = cleaned.replace(/^\s*".*":\s*.*$/gm, '');
  
  // Clean up extra whitespace and newlines
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Remove any remaining quotes around the entire response
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  
  return cleaned.trim();
}

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

    // Check feature access (admins bypass all restrictions)
    const suggestionAccess = await checkFeatureAccessWithAdmin('suggest_article_improvements', userId);
    
    if (!suggestionAccess.hasAccess) {
      return NextResponse.json(
        { error: suggestionAccess.reason || 'Subscription required for suggestions' },
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
        articleSlug: true,
        contentHtml: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Get user details for the suggestion record
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        firstName: true,
        lastName: true,
        username: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let aiResponse = '';
    let isRelevant = false;
    let shouldApply = false;

    try {
      // Create AI prompt for immediate evaluation
      const evaluationPrompt = `You are an AI assistant helping to evaluate article improvement suggestions. 
      
Article Title: ${article.articleTitle}
Article Content: ${article.contentHtml ? article.contentHtml.substring(0, 2000) : 'No content yet'}

User Suggestion:
Type: ${suggestionType}
Details: ${suggestionDetails}

Please evaluate this suggestion and respond in a conversational way as if you're chatting with the user. Be helpful and constructive.

Consider:
1. Is this suggestion relevant and potentially helpful?
2. Does it identify a real issue or improvement opportunity?
3. Is it actionable and specific enough?

Respond with ONLY a friendly, conversational message to the user. Do NOT include any JSON, technical details, or structured data in your response.

Your response should:
- Acknowledge their suggestion in a friendly way
- Explain whether the suggestion is valuable and why
- If you think it should be implemented, say so clearly
- If not, explain why in a helpful way
- Keep it conversational and encouraging
- Be concise and to the point

End your response with either:
"RELEVANT: YES" if this suggestion should be queued for implementation
"RELEVANT: NO" if this suggestion should not be implemented`;

      const response = await callAI('article_suggestion_validation', evaluationPrompt, {
        articleTitle: article.articleTitle,
        suggestionType,
      }, userId);

      aiResponse = response;
      
      // Clean up the AI response to remove any JSON or technical details
      aiResponse = cleanAIResponse(aiResponse);
      
      // Check if AI thinks the suggestion is relevant
      isRelevant = response.toLowerCase().includes('relevant: yes');
      
      // Also check for explicit approval language
      const approvalKeywords = ['should be implemented', 'good suggestion', 'excellent point', 'valid concern', 'this would improve'];
      shouldApply = approvalKeywords.some(keyword => aiResponse.toLowerCase().includes(keyword));

    } catch (aiError) {
      console.error('AI evaluation failed:', aiError);
      // Fallback response
      aiResponse = "Thanks for your suggestion! I'll review it and get back to you shortly.";
      isRelevant = true; // Default to reviewing when AI fails
    }

    // Create the suggestion record immediately
    const suggestion = await prisma.articleSuggestion.create({
      data: {
        articleId,
        clerkUserId: userId,
        suggestionType,
        suggestionDetails,
        suggestedAt: now,
        aiValidationResponse: aiResponse,
        processedAt: now,
        isApproved: isRelevant && shouldApply,
        isApplied: false,
        rejectionReason: (!isRelevant || !shouldApply) ? aiResponse : null,
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
      update: {
        lastSuggestionAt: now,
      },
      create: {
        clerkUserId: userId,
        articleId: articleId,
        lastSuggestionAt: now,
      },
    });

    // Only queue job if AI thinks it's relevant and should be applied
    let jobId = null;
    if (isRelevant && shouldApply) {
      try {
        const job = await addSuggestionToQueue({
          articleId,
          clerkUserId: userId,
          suggestionType,
          suggestionDetails,
          articleTitle: article.articleTitle,
          articleSlug: article.articleSlug,
          contentHtml: article.contentHtml || '',
          suggestionId: suggestion.suggestionId,
        });
        jobId = job.id;
        
        // Update suggestion with job ID
        await prisma.articleSuggestion.update({
          where: { suggestionId: suggestion.suggestionId },
          data: { bullmqJobId: jobId },
        });
        
      } catch (queueError) {
        console.error('Failed to queue approved suggestion:', queueError);
        // Still return success since we have the AI response
      }
    }

    // Return the immediate AI response
    return NextResponse.json({
      success: true,
      suggestion: {
        id: suggestion.suggestionId,
        status: isRelevant && shouldApply ? 'approved' : 'rejected',
        aiResponse,
        isApproved: isRelevant && shouldApply,
        rejectionReason: (!isRelevant || !shouldApply) ? aiResponse : null,
        createdAt: suggestion.suggestedAt,
      },
      jobId,
      message: isRelevant && shouldApply 
        ? 'Great suggestion! I\'ll work on implementing this change.'
        : 'Thanks for the feedback! See my response below.',
    });

  } catch (error) {
    console.error('Error processing suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to process suggestion' },
      { status: 500 }
    );
  }
}