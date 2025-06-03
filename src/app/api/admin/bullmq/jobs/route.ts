import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { emailQueue, courseGenerationQueue, sitemapQueue } from '@/lib/bullmq';

export async function GET(request: NextRequest) {
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
    const queueName = searchParams.get('queue') || 'all';
    const status = searchParams.get('status') || 'all';

    const queues = [
      { name: 'email', queue: emailQueue },
      { name: 'course-generation', queue: courseGenerationQueue },
      { name: 'sitemap', queue: sitemapQueue },
    ];

    const results = [];

    for (const { name, queue } of queues) {
      if (queueName !== 'all' && queueName !== name) continue;

      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(0, 49), // Get last 50 completed jobs
          queue.getFailed(0, 49), // Get last 50 failed jobs
          queue.getDelayed(),
        ]);

        // Format jobs with additional metadata
        const formatJobs = (jobs: any[], jobStatus: string) => 
          jobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            opts: job.opts,
            status: jobStatus,
            queue: name,
            timestamp: job.timestamp,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            attemptsMade: job.attemptsMade,
            failedReason: job.failedReason,
            returnvalue: job.returnvalue,
            delay: job.delay,
            progress: job.progress,
          }));

        let queueJobs = [];
        
        if (status === 'all' || status === 'waiting') {
          queueJobs.push(...formatJobs(waiting, 'waiting'));
        }
        if (status === 'all' || status === 'active') {
          queueJobs.push(...formatJobs(active, 'active'));
        }
        if (status === 'all' || status === 'completed') {
          queueJobs.push(...formatJobs(completed, 'completed'));
        }
        if (status === 'all' || status === 'failed') {
          queueJobs.push(...formatJobs(failed, 'failed'));
        }
        if (status === 'all' || status === 'delayed') {
          queueJobs.push(...formatJobs(delayed, 'delayed'));
        }

        results.push({
          queue: name,
          counts: {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            delayed: delayed.length,
          },
          jobs: queueJobs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
        });
      } catch (error) {
        console.error(`Error fetching jobs for queue ${name}:`, error);
        results.push({
          queue: name,
          error: error.message,
          counts: {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
          },
          jobs: [],
        });
      }
    }

    return NextResponse.json({
      success: true,
      queues: results,
    });
  } catch (error) {
    console.error('Error fetching BullMQ jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}