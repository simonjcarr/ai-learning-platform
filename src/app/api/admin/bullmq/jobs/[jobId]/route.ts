import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { emailQueue, courseGenerationQueue, sitemapQueue } from '@/lib/bullmq';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { jobId } = await params;
    const { searchParams } = new URL(request.url);
    const queueName = searchParams.get('queue');

    if (!queueName) {
      return NextResponse.json({ error: 'Queue name is required' }, { status: 400 });
    }

    const queues = {
      'email': emailQueue,
      'course-generation': courseGenerationQueue,
      'sitemap': sitemapQueue,
    };

    const queue = queues[queueName as keyof typeof queues];
    if (!queue) {
      return NextResponse.json({ error: 'Invalid queue name' }, { status: 400 });
    }

    // Try to find and remove the job
    const job = await queue.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    await job.remove();

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} removed from ${queueName} queue`,
    });
  } catch (error) {
    console.error('Error removing job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { jobId } = await params;
    const body = await request.json();
    const { action, queueName } = body;

    if (!queueName) {
      return NextResponse.json({ error: 'Queue name is required' }, { status: 400 });
    }

    const queues = {
      'email': emailQueue,
      'course-generation': courseGenerationQueue,
      'sitemap': sitemapQueue,
    };

    const queue = queues[queueName as keyof typeof queues];
    if (!queue) {
      return NextResponse.json({ error: 'Invalid queue name' }, { status: 400 });
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    switch (action) {
      case 'retry':
        if (job.attemptsMade < (job.opts.attempts || 3)) {
          await job.retry();
          return NextResponse.json({
            success: true,
            message: `Job ${jobId} retried`,
          });
        } else {
          return NextResponse.json({ error: 'Job has exhausted all retry attempts' }, { status: 400 });
        }

      case 'promote':
        if (await job.isDelayed()) {
          await job.promote();
          return NextResponse.json({
            success: true,
            message: `Job ${jobId} promoted from delayed to waiting`,
          });
        } else {
          return NextResponse.json({ error: 'Job is not delayed' }, { status: 400 });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error performing job action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}