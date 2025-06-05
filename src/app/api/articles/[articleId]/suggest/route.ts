import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { checkFeatureAccessWithAdmin } from '@/lib/feature-access-admin';
import { addSuggestionToQueue } from '@/lib/bullmq';

// No longer need long duration since we're using async processing

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

    // Add the suggestion job to the queue
    try {
      const job = await addSuggestionToQueue({
        articleId,
        clerkUserId: userId,
        suggestionType,
        suggestionDetails,
        articleTitle: article.articleTitle,
        articleSlug: article.articleSlug,
        contentHtml: article.contentHtml || '',
      });

      return NextResponse.json({
        success: true,
        jobId: job.id,
        message: 'Your suggestion has been submitted and is being processed. Please check back in a moment.',
      });
    } catch (queueError) {
      console.error('Failed to queue suggestion:', queueError);
      return NextResponse.json(
        { error: 'Failed to submit suggestion. Please try again later.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to process suggestion' },
      { status: 500 }
    );
  }
}