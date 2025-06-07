import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { RateLimitError } from './rate-limit';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryDelayOnFailover: 100,
  connectTimeout: 10000,
  commandTimeout: 5000,
});

// Handle connection errors gracefully during build
connection.on('error', (error) => {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
    // In production, log the error but don't crash
    console.warn('Redis connection error:', error.message);
  } else if (process.env.CI || process.env.NODE_ENV === 'test') {
    // During CI/build, suppress Redis errors
    console.log('Redis connection unavailable during build/test, this is expected');
  } else {
    // In development, log the full error
    console.error('Redis connection error:', error);
  }
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

export const courseGenerationQueue = new Queue('course-generation', {
  connection: connection.duplicate(),
  defaultJobOptions: {
    removeOnComplete: {
      age: 7 * 24 * 3600, // keep completed jobs for 7 days
      count: 50, // keep the last 50 completed jobs
    },
    removeOnFail: {
      age: 14 * 24 * 3600, // keep failed jobs for 14 days
      count: 100, // keep last 100 failed jobs
    },
    attempts: 5, // Increased for rate limit retries
    backoff: {
      type: 'custom',
      settings: {},
    },
  },
});

export const courseGenerationQueueEvents = new QueueEvents('course-generation', {
  connection: connection.duplicate(),
});

export const suggestionQueue = new Queue('suggestion', {
  connection: connection.duplicate(),
  defaultJobOptions: {
    removeOnComplete: {
      age: 24 * 3600, // keep completed jobs for 24 hours
      count: 100, // keep the last 100 completed jobs
    },
    removeOnFail: {
      age: 48 * 3600, // keep failed jobs for 48 hours
      count: 100, // keep last 100 failed jobs
    },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const suggestionQueueEvents = new QueueEvents('suggestion', {
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

export type CourseGenerationJobData = {
  courseId: string;
  jobType: 'outline' | 'article_content' | 'quiz_generation' | 'final_exam_bank' | 'video_enhancement';
  sectionId?: string;
  articleId?: string;
  context?: {
    courseTitle?: string;
    courseDescription?: string;
    courseLevel?: string;
    sectionTitle?: string;
    sectionDescription?: string;
    articleTitle?: string;
    articleDescription?: string;
    regenerateOnly?: boolean;
  };
};

export type SuggestionJobData = {
  articleId: string;
  clerkUserId: string;
  suggestionType: string;
  suggestionDetails: string;
  articleTitle: string;
  articleSlug: string;
  contentHtml: string;
  suggestionId: string;
};

export async function addEmailToQueue(data: EmailJobData) {
  return await emailQueue.add('send-email', data);
}

export async function addSitemapToQueue(data: SitemapJobData) {
  try {
    // Check if there's already a pending sitemap job
    console.log('🔍 Checking sitemap queue status...');
    console.log('🔍 Redis connection test before queue check...');
    
    const waiting = await sitemapQueue.getWaiting();
    const active = await sitemapQueue.getActive();
    
    console.log(`📊 Queue status - Waiting: ${waiting.length}, Active: ${active.length}`);
    
    if (waiting.length > 0 || active.length > 0) {
      console.log('⏭️ Sitemap generation already in progress, skipping...');
      return null;
    }
    
    console.log('➕ Adding sitemap job to queue with 30s delay...');
    
    // Use timestamp to ensure unique job IDs and avoid Redis rejecting duplicates
    const uniqueJobId = `sitemap-regenerate-${Date.now()}`;
    
    const job = await sitemapQueue.add('regenerate-sitemap', data, {
      // Delay sitemap generation by 30 seconds to batch multiple article updates
      delay: 30000,
      // Use unique job ID to avoid conflicts
      jobId: uniqueJobId,
    });
    
    console.log(`✅ Sitemap job added with ID: ${job.id}`);
    console.log(`🕐 Job will execute at: ${new Date(Date.now() + 30000).toISOString()}`);
    
    return job;
  } catch (error) {
    console.error('❌ Error in addSitemapToQueue:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    throw error;
  }
}

// Custom backoff strategy for handling rate limits
export function customBackoffStrategy(attemptsMade: number, type: string, err?: Error): number {
  // If it's a rate limit error, use the retry-after time or default to 60 seconds
  if (err instanceof RateLimitError) {
    const retryAfter = err.retryAfter || 60;
    console.log(`🔄 Rate limit detected, retrying in ${retryAfter} seconds`);
    return retryAfter * 1000; // Convert to milliseconds
  }
  
  // For other errors, use exponential backoff
  const baseDelay = 10000; // 10 seconds
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attemptsMade - 1), 300000); // Max 5 minutes
  console.log(`🔄 Retrying job attempt ${attemptsMade} in ${exponentialDelay / 1000} seconds`);
  return exponentialDelay;
}

export async function addCourseGenerationToQueue(data: CourseGenerationJobData) {
  try {
    console.log(`🎓 Adding course generation job: ${data.jobType} for course ${data.courseId}`);
    
    const job = await courseGenerationQueue.add(`course-${data.jobType}`, data, {
      // Delay slightly to ensure database updates are committed
      delay: 1000,
      backoff: {
        type: 'custom',
      },
    });
    
    console.log(`✅ Course generation job added with ID: ${job.id}`);
    return job;
  } catch (error) {
    console.error('❌ Error in addCourseGenerationToQueue:', error);
    throw error;
  }
}

export async function addSuggestionToQueue(data: SuggestionJobData) {
  try {
    console.log(`💡 Adding suggestion job for article ${data.articleId}`);
    
    const job = await suggestionQueue.add('process-suggestion', data, {
      // No delay needed, process immediately
      removeOnComplete: {
        age: 24 * 3600, // Keep for 24 hours for status checking
        count: 100,
      },
    });
    
    console.log(`✅ Suggestion job added with ID: ${job.id}`);
    return job;
  } catch (error) {
    console.error('❌ Error in addSuggestionToQueue:', error);
    throw error;
  }
}