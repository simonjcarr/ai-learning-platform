import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { checkSubscription } from '@/lib/subscription-check';
import { trackAIInteraction } from '@/lib/ai-service';
import OpenAI from 'openai';

export async function POST(
  request: NextRequest,
  { params }: { params: { articleId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
          articleId: params.articleId,
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
      where: { articleId: params.articleId },
      select: {
        articleId: true,
        articleTitle: true,
        contentHtml: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Get AI model for suggestion validation
    const interactionType = await prisma.aIInteractionType.findUnique({
      where: { typeName: 'article_suggestion_validation' },
      include: { defaultModel: true },
    });

    const aiModel = interactionType?.defaultModel || (await prisma.aIModel.findFirst({
      where: { isActive: true, isDefault: true },
    }));

    if (!aiModel) {
      return NextResponse.json(
        { error: 'No AI model configured' },
        { status: 500 }
      );
    }

    // Prepare AI prompt
    const prompt = `You are an AI assistant helping to validate and apply user suggestions to educational articles.

Article Title: ${article.articleTitle}
Current Content:
${article.contentHtml}

User Suggestion Type: ${suggestionType}
User Suggestion Details: ${suggestionDetails}

Please analyze this suggestion and:
1. Determine if the suggestion is valid and appropriate for the article's target audience and scope
2. If valid, provide the updated article content incorporating the suggestion
3. If invalid, explain why the suggestion is not appropriate

Response format:
{
  "isValid": true/false,
  "reason": "Explanation of why the suggestion is valid or invalid",
  "updatedContent": "Full updated HTML content if valid, null if invalid"
}`;

    // Call OpenAI
    const openai = new OpenAI({ apiKey: aiModel.apiKey });
    
    const completion = await openai.chat.completions.create({
      model: aiModel.modelName,
      messages: [
        {
          role: 'system',
          content: 'You are an expert technical content reviewer. Respond only with valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: aiModel.maxTokens || 4000,
    });

    const response = completion.choices[0].message.content;
    const usage = completion.usage;

    // Track AI interaction
    const aiInteraction = await trackAIInteraction({
      userId,
      modelId: aiModel.modelId,
      interactionTypeId: interactionType?.typeId || 'article_suggestion_validation',
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      prompt,
      response: response || '',
      contextData: { articleId: params.articleId, suggestionType },
    });

    // Parse AI response
    let aiValidation;
    try {
      aiValidation = JSON.parse(response || '{}');
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return NextResponse.json(
        { error: 'Invalid AI response format' },
        { status: 500 }
      );
    }

    // Create suggestion record
    const suggestion = await prisma.articleSuggestion.create({
      data: {
        articleId: params.articleId,
        clerkUserId: userId,
        suggestionType,
        suggestionDetails,
        aiValidationResponse: response,
        isApproved: aiValidation.isValid === true,
        rejectionReason: aiValidation.isValid ? null : aiValidation.reason,
        processedAt: new Date(),
        aiInteractionId: aiInteraction.interactionId,
      },
    });

    // If approved, update the article
    if (aiValidation.isValid && aiValidation.updatedContent) {
      await prisma.article.update({
        where: { articleId: params.articleId },
        data: {
          contentHtml: aiValidation.updatedContent,
          updatedAt: new Date(),
        },
      });

      await prisma.articleSuggestion.update({
        where: { suggestionId: suggestion.suggestionId },
        data: {
          isApplied: true,
          appliedAt: new Date(),
        },
      });
    }

    // Update rate limit
    await prisma.suggestionRateLimit.upsert({
      where: {
        clerkUserId_articleId: {
          clerkUserId: userId,
          articleId: params.articleId,
        },
      },
      update: { lastSuggestionAt: now },
      create: {
        clerkUserId: userId,
        articleId: params.articleId,
        lastSuggestionAt: now,
      },
    });

    // Check for badge achievements
    const approvedCount = await prisma.articleSuggestion.count({
      where: {
        clerkUserId: userId,
        isApproved: true,
      },
    });

    const badges = [];
    const thresholds = (settings?.badgeThresholds as { bronze?: number; silver?: number; gold?: number }) || { bronze: 5, silver: 10, gold: 25 };
    
    if (approvedCount >= thresholds.bronze) badges.push('bronze');
    if (approvedCount >= thresholds.silver) badges.push('silver');
    if (approvedCount >= thresholds.gold) badges.push('gold');

    return NextResponse.json({
      success: true,
      suggestion: {
        id: suggestion.suggestionId,
        isApproved: suggestion.isApproved,
        reason: aiValidation.reason,
        isApplied: suggestion.isApplied,
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