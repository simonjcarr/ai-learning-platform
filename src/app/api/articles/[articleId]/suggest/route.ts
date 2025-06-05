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
      // Create AI prompt that matches the expected JSON format
      const evaluationPrompt = `Article Title: ${article.articleTitle}
Article Content: ${article.contentHtml ? article.contentHtml.substring(0, 2000) : 'No content yet'}

User Suggestion:
Type: ${suggestionType}
Details: ${suggestionDetails}

Evaluate this suggestion for technical accuracy, educational value, and whether it should be implemented.

Consider:
1. Does this fix an error, outdated information, or improve accuracy?
2. Would this make the article more helpful for learners?
3. Is the suggestion technically correct and actionable?

Respond with a JSON object containing:
- isApproved: boolean (true if this should be implemented)
- reasoning: string (friendly explanation of your decision - be conversational and encouraging)

Be decisive - approve suggestions that improve the article, reject those that don't add value or could cause confusion.`;

      const response = await callAI('article_suggestion_validation', evaluationPrompt, {
        articleTitle: article.articleTitle,
        suggestionType,
      }, userId);

      aiResponse = response;
      
      // Parse JSON response from AI
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const aiDecision = JSON.parse(jsonMatch[0]);
          isRelevant = aiDecision.isApproved === true;
          shouldApply = aiDecision.isApproved === true;
          
          // Use the reasoning as the AI response for display
          if (aiDecision.reasoning) {
            aiResponse = aiDecision.reasoning;
          }
        } else {
          // Fallback to old method if no JSON found
          isRelevant = response.toLowerCase().includes('relevant: yes');
          shouldApply = response.toLowerCase().includes('should implement') || 
                       response.toLowerCase().includes('should update') ||
                       response.toLowerCase().includes('should be implemented');
        }
      } catch (jsonError) {
        console.error('Failed to parse AI JSON response:', jsonError);
        // Fallback to old method
        isRelevant = response.toLowerCase().includes('relevant: yes');
        shouldApply = response.toLowerCase().includes('should implement') || 
                     response.toLowerCase().includes('should update') ||
                     response.toLowerCase().includes('should be implemented');
      }
      
      // Debug logging for job creation
      console.log('Job creation check:', {
        isRelevant,
        shouldApply,
        willCreateJob: isRelevant && shouldApply,
        aiResponseType: typeof aiResponse,
        aiResponsePreview: aiResponse.substring(0, 100)
      });

    } catch (aiError) {
      console.error('AI evaluation failed:', aiError);
      // Fallback response
      aiResponse = "Thanks for your suggestion! I'll review it and get back to you shortly.";
      isRelevant = true; // Default to reviewing when AI fails
    }

    // Store the AI response for display (already cleaned from JSON parsing)
    const displayResponse = aiResponse;
    
    // Create the suggestion record immediately
    const suggestion = await prisma.articleSuggestion.create({
      data: {
        articleId,
        clerkUserId: userId,
        suggestionType,
        suggestionDetails,
        suggestedAt: now,
        aiValidationResponse: displayResponse,
        processedAt: now,
        isApproved: isRelevant && shouldApply,
        isApplied: false,
        rejectionReason: (!isRelevant || !shouldApply) ? displayResponse : null,
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
      console.log('Creating BullMQ job for approved suggestion:', suggestion.suggestionId);
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
        console.log('BullMQ job created successfully with ID:', jobId);
        
      } catch (queueError) {
        console.error('Failed to queue approved suggestion:', queueError);
        // Still return success since we have the AI response
      }
    } else {
      console.log('Not creating job - suggestion not approved for implementation:', {
        isRelevant,
        shouldApply,
        suggestionId: suggestion.suggestionId
      });
    }

    // Return the immediate AI response
    return NextResponse.json({
      success: true,
      suggestion: {
        id: suggestion.suggestionId,
        status: isRelevant && shouldApply ? 'approved' : 'rejected',
        aiResponse: displayResponse,
        isApproved: isRelevant && shouldApply,
        rejectionReason: (!isRelevant || !shouldApply) ? displayResponse : null,
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