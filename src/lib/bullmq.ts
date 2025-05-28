import { Queue, Worker, QueueEvents } from 'bullmq';
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

export const queueEvents = new QueueEvents('email', {
  connection: connection.duplicate(),
});

export type EmailJobData = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  templateData?: Record<string, any>;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
};

export async function addEmailToQueue(data: EmailJobData) {
  return await emailQueue.add('send-email', data);
}