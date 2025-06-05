import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@/lib/prisma';
import { aiService } from '@/lib/ai-service';
import { emails } from '@/lib/email-service';
import { SuggestionJobData } from '@/lib/bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

async function processSuggestion(job: Job<SuggestionJobData>) {
  const { articleId, clerkUserId, suggestionType, suggestionDetails, articleTitle, articleSlug, contentHtml, suggestionId } = job.data;
  
  console.log(`🔄 Processing suggestion job ${job.id} for article ${articleId}`);
  
  try {
    // Update job progress
    await job.updateProgress(10);
    
    // Call AI service for validation
    let aiValidation;
    const aiStartTime = Date.now();
    console.log(`Starting AI validation for article ${articleId} (${contentHtml?.length || 0} chars)`);
    
    try {
      aiValidation = await aiService.validateArticleSuggestion(
        articleTitle,
        contentHtml || '',
        suggestionType,
        suggestionDetails,
        clerkUserId
      );
      
      const aiEndTime = Date.now();
      console.log(`AI validation completed in ${aiEndTime - aiStartTime}ms`);
      
      // If worker AI rejected but didn't generate content, check if API route approved
      if (!aiValidation.isValid && !aiValidation.updatedContent) {
        console.log('Worker AI rejected suggestion, checking if API route approved...');
        
        // Get the existing suggestion to check API route's decision
        const existingSuggestion = await prisma.articleSuggestion.findUnique({
          where: { suggestionId: suggestionId },
        });
        
        if (existingSuggestion?.isApproved) {
          console.log('API route approved suggestion, forcing content generation...');
          
          // Force generate content by calling AI with a different prompt
          try {
            const forceGenerationResult = await aiService.validateArticleSuggestion(
              articleTitle + ' (IMPLEMENT APPROVED SUGGESTION)',
              contentHtml || '',
              suggestionType,
              suggestionDetails + ' [USER APPROVED - IMPLEMENT THIS CHANGE NOW]',
              clerkUserId
            );
            
            // Use the forced generation result if it has content
            if (forceGenerationResult.updatedContent && forceGenerationResult.diff) {
              aiValidation = {
                ...aiValidation,
                isValid: true, // Override the validity since API route approved
                updatedContent: forceGenerationResult.updatedContent,
                diff: forceGenerationResult.diff,
                description: forceGenerationResult.description || 'Applied user-approved suggestion'
              };
              console.log('Successfully generated content for API-approved suggestion');
            }
          } catch (forceError) {
            console.error('Failed to force generate content:', forceError);
          }
        }
      }
    } catch (aiError) {
      console.error('AI service error:', aiError);
      
      // If AI validation fails, create a suggestion record but don't auto-approve
      aiValidation = {
        isValid: false,
        reason: 'AI validation temporarily unavailable. Your suggestion has been recorded for manual review.',
        updatedContent: null
      };
    }
    
    await job.updateProgress(50);
    
    // Variable to track if the article was successfully updated
    let articleUpdateSuccess = false;
    let articleUpdateError: string | null = null;
    let changeHistoryId: string | null = null;
    
    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get the existing suggestion to preserve the user-friendly AI response
      const existingSuggestion = await tx.articleSuggestion.findUnique({
        where: { suggestionId: suggestionId },
      });

      // Trust the API route's approval/rejection decision 
      // Worker only overrides for spam detection or critical security issues
      const isSpamOrSecurity = !aiValidation.isValid && (
        aiValidation.reason?.toLowerCase().includes('spam') ||
        aiValidation.reason?.toLowerCase().includes('url') ||
        aiValidation.reason?.toLowerCase().includes('external') ||
        aiValidation.reason?.toLowerCase().includes('security')
      );
      
      const updateData = {
        // Preserve API route's decision unless worker found spam/security issues
        isApproved: isSpamOrSecurity ? false : existingSuggestion?.isApproved,
        // Always preserve the user-friendly AI response from API route
        aiValidationResponse: existingSuggestion?.aiValidationResponse,
        // Only set rejection reason for spam/security, preserve existing otherwise
        rejectionReason: isSpamOrSecurity ? aiValidation.reason : existingSuggestion?.rejectionReason,
        processedAt: new Date(),
        aiInteractionId: null,
      };

      const suggestion = await tx.articleSuggestion.update({
        where: {
          suggestionId: suggestionId,
        },
        data: updateData,
      });
      
      // Apply changes if either worker AI approves OR API route already approved the suggestion
      const shouldApplyChanges = (aiValidation.isValid === true || existingSuggestion?.isApproved === true) 
        && aiValidation.updatedContent && aiValidation.diff;
        
      console.log('Content application check:', {
        workerAIValid: aiValidation.isValid,
        apiRouteApproved: existingSuggestion?.isApproved,
        hasUpdatedContent: !!aiValidation.updatedContent,
        hasDiff: !!aiValidation.diff,
        shouldApplyChanges
      });
        
      if (shouldApplyChanges) {
        console.log('Applying content changes to article...');
        try {
          const updatedMarkdownFromAI = aiValidation.updatedContent;
          
          // Validate that the updated content is not empty
          if (!updatedMarkdownFromAI || updatedMarkdownFromAI.trim().length === 0) {
            throw new Error('AI returned empty content for the article update');
          }
          
          // Create change history record
          const changeHistory = await tx.articleChangeHistory.create({
            data: {
              articleId: articleId,
              suggestionId: suggestion.suggestionId,
              clerkUserId: clerkUserId,
              diff: aiValidation.diff,
              beforeContent: contentHtml || '',
              afterContent: updatedMarkdownFromAI,
              changeType: 'suggestion',
              description: aiValidation.description || `Applied ${suggestionType}: ${suggestionDetails.substring(0, 100)}...`,
              isActive: true,
            },
          });
          
          changeHistoryId = changeHistory.id;
          
          // The field 'contentHtml' actually stores Markdown in this project
          await tx.article.update({
            where: { articleId: articleId },
            data: {
              contentHtml: updatedMarkdownFromAI, // Update the field with new Markdown
            },
          });
          
          // Mark the suggestion as applied
          await tx.articleSuggestion.update({
            where: { suggestionId: suggestion.suggestionId },
            data: {
              isApplied: true,
              appliedAt: new Date(),
            },
          });
          
          articleUpdateSuccess = true;
          console.log(`Article ${articleId} successfully updated with AI suggestion and change history recorded.`);
        } catch (dbUpdateError) {
          console.error(`DB Error: Failed to update article ${articleId} with AI suggestion:`, dbUpdateError);
          articleUpdateError = dbUpdateError instanceof Error ? dbUpdateError.message : 'Unknown error occurred';
          
          // Override the AI validation to reflect the failure
          aiValidation.isValid = false;
          aiValidation.reason = `The suggestion was valid but could not be applied due to a system error: ${articleUpdateError}. Your suggestion has been recorded for manual review.`;
          
          // Update the suggestion with the failure reason
          await tx.articleSuggestion.update({
            where: { suggestionId: suggestion.suggestionId },
            data: {
              isApproved: false,
              rejectionReason: aiValidation.reason,
            },
          });
        }
      }
      
      return { suggestion, changeHistoryId };
    });
    
    await job.updateProgress(80);
    
    const { suggestion } = result;
    
    // Send approval email if suggestion was approved and applied
    if (suggestion.isApproved && articleUpdateSuccess) {
      try {
        const user = await prisma.user.findUnique({
          where: { clerkUserId: clerkUserId },
          select: { email: true, firstName: true }
        });
        
        if (user) {
          await emails.sendSuggestionApproved(
            user.email,
            user.firstName || "User",
            articleTitle,
            articleSlug
          );
          console.log(`Suggestion approval email sent to ${user.email}`);
        }
      } catch (emailError) {
        console.error(`Failed to send suggestion approval email:`, emailError);
        // Don't fail the suggestion if email fails
      }
    }
    
    // Update rate limit
    const now = new Date();
    await prisma.suggestionRateLimit.upsert({
      where: {
        clerkUserId_articleId: {
          clerkUserId: clerkUserId,
          articleId: articleId,
        },
      },
      update: { lastSuggestionAt: now },
      create: {
        clerkUserId: clerkUserId,
        articleId: articleId,
        lastSuggestionAt: now,
      },
    });
    
    await job.updateProgress(90);
    
    // Check for badge achievements
    const approvedCount = await prisma.articleSuggestion.count({
      where: { clerkUserId: clerkUserId, isApproved: true },
    });
    const previousCount = approvedCount - (suggestion.isApproved ? 1 : 0);
    
    const badges: string[] = [];
    const newBadges: string[] = [];
    
    // Get suggestion settings for badge thresholds
    const settings = await prisma.suggestionSettings.findFirst();
    
    if (settings?.badgeThresholds && typeof settings.badgeThresholds === 'object' && settings.badgeThresholds !== null) {
      const thresholds = settings.badgeThresholds as Record<string, unknown>;
      
      if (typeof thresholds.bronze === 'number' && approvedCount >= thresholds.bronze) {
        badges.push('bronze');
        if (previousCount < thresholds.bronze) newBadges.push('bronze');
      }
      if (typeof thresholds.silver === 'number' && approvedCount >= thresholds.silver) {
        badges.push('silver');
        if (previousCount < thresholds.silver) newBadges.push('silver');
      }
      if (typeof thresholds.gold === 'number' && approvedCount >= thresholds.gold) {
        badges.push('gold');
        if (previousCount < thresholds.gold) newBadges.push('gold');
      }
    }
    
    // Send achievement emails for newly unlocked badges
    if (newBadges.length > 0) {
      try {
        const user = await prisma.user.findUnique({
          where: { clerkUserId: clerkUserId },
          select: { email: true, firstName: true }
        });
        
        if (user) {
          for (const badge of newBadges) {
            const achievementDescriptions = {
              bronze: "You've had 5 suggestions approved! Keep contributing to the community.",
              silver: "Impressive! 10 approved suggestions shows your dedication to helping others learn.",
              gold: "Outstanding! 25 approved suggestions makes you a valued contributor to our platform."
            };
            
            await emails.sendAchievementUnlocked(
              user.email,
              user.firstName || "User",
              `${badge.charAt(0).toUpperCase() + badge.slice(1)} Contributor`,
              achievementDescriptions[badge as keyof typeof achievementDescriptions]
            );
            console.log(`Achievement email sent for ${badge} badge to ${user.email}`);
          }
        }
      } catch (emailError) {
        console.error(`Failed to send achievement email:`, emailError);
        // Don't fail the suggestion if email fails
      }
    }
    
    await job.updateProgress(100);
    
    return {
      success: true,
      suggestion: {
        suggestionId: suggestion.suggestionId,
        isApproved: suggestion.isApproved,
        rejectionReason: suggestion.rejectionReason,
        articleUpdated: suggestion.isApproved && articleUpdateSuccess,
      },
      approvedSuggestionsCount: approvedCount,
      badges,
    };
  } catch (error) {
    console.error('Error processing suggestion:', error);
    throw error;
  }
}

// Create the worker
const suggestionWorker = new Worker<SuggestionJobData>(
  'suggestion',
  processSuggestion,
  {
    connection: connection.duplicate(),
    concurrency: 2, // Process up to 2 suggestions at a time
  }
);

// Worker event handlers
suggestionWorker.on('completed', (job) => {
  console.log(`✅ Suggestion job ${job.id} completed successfully`);
});

suggestionWorker.on('failed', (job, err) => {
  console.error(`❌ Suggestion job ${job?.id} failed:`, err);
});

suggestionWorker.on('progress', (job, progress) => {
  console.log(`📊 Suggestion job ${job.id} progress: ${progress}%`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing suggestion worker...');
  await suggestionWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing suggestion worker...');
  await suggestionWorker.close();
  process.exit(0);
});

console.log('🚀 Suggestion worker started');