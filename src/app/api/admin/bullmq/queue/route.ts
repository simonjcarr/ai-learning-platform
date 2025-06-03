import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { emailQueue, courseGenerationQueue, sitemapQueue } from '@/lib/bullmq';

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const queueName = searchParams.get('queue');
    const jobStatus = searchParams.get('status') || 'all';

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

    let clearedCount = 0;

    if (jobStatus === 'all') {
      // Clear all jobs from all states
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(), 
        queue.getCompleted(0, -1), // Get all completed jobs
        queue.getFailed(0, -1), // Get all failed jobs
        queue.getDelayed(),
      ]);

      // Remove jobs from each state
      const removePromises = [
        ...waiting.map(job => job.remove()),
        ...active.map(job => job.remove()),
        ...completed.map(job => job.remove()),
        ...failed.map(job => job.remove()),
        ...delayed.map(job => job.remove()),
      ];

      await Promise.all(removePromises);
      clearedCount = waiting.length + active.length + completed.length + failed.length + delayed.length;
    } else {
      // Clear specific job types
      switch (jobStatus) {
        case 'waiting':
          const waitingJobs = await queue.getWaiting();
          await Promise.all(waitingJobs.map(job => job.remove()));
          clearedCount = waitingJobs.length;
          break;
        case 'active':
          const activeJobs = await queue.getActive();
          await Promise.all(activeJobs.map(job => job.remove()));
          clearedCount = activeJobs.length;
          break;
        case 'completed':
          const completedJobs = await queue.getCompleted(0, -1); // Get all completed jobs
          await Promise.all(completedJobs.map(job => job.remove()));
          clearedCount = completedJobs.length;
          break;
        case 'failed':
          const failedJobs = await queue.getFailed(0, -1); // Get all failed jobs
          await Promise.all(failedJobs.map(job => job.remove()));
          clearedCount = failedJobs.length;
          break;
        case 'delayed':
          const delayedJobs = await queue.getDelayed();
          await Promise.all(delayedJobs.map(job => job.remove()));
          clearedCount = delayedJobs.length;
          break;
        default:
          return NextResponse.json({ error: 'Invalid job status' }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${clearedCount} ${jobStatus === 'all' ? '' : jobStatus + ' '}jobs cleared from ${queueName} queue`,
      clearedCount,
    });
  } catch (error) {
    console.error('Error clearing queue:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}