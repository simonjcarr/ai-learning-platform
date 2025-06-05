import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { suggestionQueue } from '@/lib/bullmq';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get jobId from query params
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    // Await params in Next.js 15
    const { articleId } = await params;

    // Get the job from the queue
    const job = await suggestionQueue.getJob(jobId);
    
    if (!job) {
      // Job not found, check if there's a completed suggestion in the database
      const suggestion = await prisma.articleSuggestion.findFirst({
        where: {
          articleId: articleId,
          clerkUserId: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          suggestionId: true,
          isApproved: true,
          rejectionReason: true,
          isApplied: true,
          processedAt: true,
        },
      });

      if (suggestion && suggestion.processedAt) {
        // Get approved count for badges
        const approvedCount = await prisma.articleSuggestion.count({
          where: { clerkUserId: userId, isApproved: true },
        });

        return NextResponse.json({
          status: 'completed',
          result: {
            success: true,
            suggestion: {
              suggestionId: suggestion.suggestionId,
              isApproved: suggestion.isApproved,
              rejectionReason: suggestion.rejectionReason,
              articleUpdated: suggestion.isApproved && suggestion.isApplied,
            },
            approvedSuggestionsCount: approvedCount,
          },
        });
      }

      return NextResponse.json({
        status: 'not_found',
        message: 'Job not found or already processed',
      });
    }

    // Get job state
    const state = await job.getState();
    const progress = job.progress;
    
    if (state === 'completed') {
      const result = job.returnvalue;
      return NextResponse.json({
        status: 'completed',
        result,
      });
    } else if (state === 'failed') {
      return NextResponse.json({
        status: 'failed',
        error: job.failedReason || 'Processing failed',
      });
    } else {
      // Job is still processing
      return NextResponse.json({
        status: state, // 'waiting', 'active', 'delayed', 'stalled', etc.
        progress: progress || 0,
      });
    }
  } catch (error) {
    console.error('Error checking suggestion status:', error);
    return NextResponse.json(
      { error: 'Failed to check suggestion status' },
      { status: 500 }
    );
  }
}