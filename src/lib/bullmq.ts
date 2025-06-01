import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const emailQueue = new Queue('email', {
  connection: connection.duplicate(),
  defaultJobOptions: {
    removeOnComplete: {
      age: 24 * 3600, // keep completed jobs for 24 hours
      count: 100, // keep the last 100 completed jobs
    },
    removeOnFail: {
      age: 48 * 3600, // keep failed jobs for 48 hours
    },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const sitemapQueue = new Queue('sitemap', {
  connection: connection.duplicate(),
  defaultJobOptions: {
    removeOnComplete: {
      age: 7 * 24 * 3600, // keep completed jobs for 7 days
      count: 20, // keep the last 20 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep failed jobs for 7 days
      count: 50, // keep last 50 failed jobs
    },
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const queueEvents = new QueueEvents('email', {
  connection: connection.duplicate(),
});

export const sitemapQueueEvents = new QueueEvents('sitemap', {
  connection: connection.duplicate(),
});

export type EmailJobData = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  templateData?: Record<string, unknown>;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
};

export type SitemapJobData = {
  type: 'regenerate';
  triggerBy?: string;
  articleId?: string;
};

export async function addEmailToQueue(data: EmailJobData) {
  return await emailQueue.add('send-email', data);
}

export async function addSitemapToQueue(data: SitemapJobData) {
  // Check if there's already a pending sitemap job
  const waiting = await sitemapQueue.getWaiting();
  const active = await sitemapQueue.getActive();
  
  if (waiting.length > 0 || active.length > 0) {
    console.log('Sitemap generation already in progress, skipping...');
    return null;
  }
  
  return await sitemapQueue.add('regenerate-sitemap', data, {
    // Delay sitemap generation by 30 seconds to batch multiple article updates
    delay: 30000,
    // Remove duplicate jobs
    jobId: 'sitemap-regenerate',
  });
}