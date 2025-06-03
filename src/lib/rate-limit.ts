import Redis from 'ioredis';
import { prisma } from './prisma';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Rate limit configuration
const RATE_LIMIT_TIMEOUT_SECONDS = 60; // 1 minute timeout
const RATE_LIMIT_KEY_PREFIX = 'ai_rate_limit:';

// Error patterns for different AI providers
const RATE_LIMIT_ERROR_PATTERNS = {
  openai: [
    'rate limit exceeded',
    'too many requests',
    'rate_limit_exceeded',
    'quota exceeded',
    'insufficient_quota'
  ],
  anthropic: [
    'rate limit exceeded',
    'too many requests',
    'rate_limit_exceeded',
    'quota exceeded',
    'overloaded_error'
  ],
  google: [
    'rate limit exceeded',
    'quota exceeded',
    'too many requests',
    'resource_exhausted',
    'quotaExceeded'
  ]
};

// HTTP status codes that indicate rate limiting
const RATE_LIMIT_STATUS_CODES = [429, 503, 520, 521, 522, 524];

export class RateLimitError extends Error {
  constructor(
    message: string,
    public provider: string,
    public modelId: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export interface RateLimitInfo {
  isRateLimited: boolean;
  timeoutUntil?: Date;
  secondsRemaining?: number;
  provider?: string;
  modelId?: string;
}

export class RateLimitManager {
  /**
   * Check if an error indicates a rate limit
   */
  static isRateLimitError(error: any, provider: string): boolean {
    if (!error) return false;

    const errorMessage = (error.message || error.toString()).toLowerCase();
    const errorCode = error.code || error.status;

    // Check HTTP status codes
    if (RATE_LIMIT_STATUS_CODES.includes(errorCode)) {
      return true;
    }

    // Check provider-specific error patterns
    const patterns = RATE_LIMIT_ERROR_PATTERNS[provider as keyof typeof RATE_LIMIT_ERROR_PATTERNS] || [];
    return patterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Extract retry-after time from error (if available)
   */
  static extractRetryAfter(error: any): number | undefined {
    // Check for Retry-After header or similar
    if (error.headers?.['retry-after']) {
      const retryAfter = parseInt(error.headers['retry-after'], 10);
      if (!isNaN(retryAfter)) {
        return retryAfter;
      }
    }

    // Check for rate limit info in error message
    const message = error.message || error.toString();
    const retryMatch = message.match(/retry.{0,10}(\d+)/i);
    if (retryMatch) {
      return parseInt(retryMatch[1], 10);
    }

    return undefined;
  }

  /**
   * Set rate limit timeout for a specific provider/model
   */
  static async setRateLimit(provider: string, modelId: string, retryAfter?: number): Promise<void> {
    const timeoutSeconds = retryAfter || RATE_LIMIT_TIMEOUT_SECONDS;
    const key = `${RATE_LIMIT_KEY_PREFIX}${provider}:${modelId}`;
    const timeoutUntil = new Date(Date.now() + timeoutSeconds * 1000);

    console.log(`🚫 Rate limit detected for ${provider}:${modelId}. Timeout until ${timeoutUntil.toISOString()}`);

    try {
      // Set rate limit in Redis with expiration
      await redis.setex(key, timeoutSeconds, timeoutUntil.toISOString());
      
      // Also track in database for monitoring
      await prisma.aIRateLimit.upsert({
        where: {
          provider_modelId: {
            provider,
            modelId,
          },
        },
        update: {
          isActive: true,
          timeoutUntil,
          hitCount: {
            increment: 1,
          },
          lastHitAt: new Date(),
        },
        create: {
          provider,
          modelId,
          isActive: true,
          timeoutUntil,
          hitCount: 1,
          firstHitAt: new Date(),
          lastHitAt: new Date(),
        },
      });

      console.log(`✅ Rate limit timeout set for ${provider}:${modelId} until ${timeoutUntil.toISOString()}`);
    } catch (error) {
      console.error(`❌ Failed to set rate limit for ${provider}:${modelId}:`, error);
    }
  }

  /**
   * Check if a provider/model is currently rate limited
   */
  static async checkRateLimit(provider: string, modelId: string): Promise<RateLimitInfo> {
    const key = `${RATE_LIMIT_KEY_PREFIX}${provider}:${modelId}`;

    try {
      const timeoutUntilStr = await redis.get(key);
      
      if (!timeoutUntilStr) {
        return { isRateLimited: false };
      }

      const timeoutUntil = new Date(timeoutUntilStr);
      const now = new Date();

      if (now >= timeoutUntil) {
        // Timeout has expired, clear it
        await redis.del(key);
        await this.clearRateLimit(provider, modelId);
        return { isRateLimited: false };
      }

      const secondsRemaining = Math.ceil((timeoutUntil.getTime() - now.getTime()) / 1000);

      return {
        isRateLimited: true,
        timeoutUntil,
        secondsRemaining,
        provider,
        modelId,
      };
    } catch (error) {
      console.error(`❌ Failed to check rate limit for ${provider}:${modelId}:`, error);
      return { isRateLimited: false };
    }
  }

  /**
   * Clear rate limit for a provider/model
   */
  static async clearRateLimit(provider: string, modelId: string): Promise<void> {
    const key = `${RATE_LIMIT_KEY_PREFIX}${provider}:${modelId}`;

    try {
      await redis.del(key);
      
      // Update database record
      await prisma.aIRateLimit.updateMany({
        where: {
          provider,
          modelId,
          isActive: true,
        },
        data: {
          isActive: false,
          clearedAt: new Date(),
        },
      });

      console.log(`✅ Rate limit cleared for ${provider}:${modelId}`);
    } catch (error) {
      console.error(`❌ Failed to clear rate limit for ${provider}:${modelId}:`, error);
    }
  }

  /**
   * Get all currently active rate limits
   */
  static async getActiveRateLimits(): Promise<RateLimitInfo[]> {
    try {
      const keys = await redis.keys(`${RATE_LIMIT_KEY_PREFIX}*`);
      const rateLimits: RateLimitInfo[] = [];

      for (const key of keys) {
        const [, providerModel] = key.split(RATE_LIMIT_KEY_PREFIX);
        const [provider, modelId] = providerModel.split(':');
        
        const info = await this.checkRateLimit(provider, modelId);
        if (info.isRateLimited) {
          rateLimits.push(info);
        }
      }

      return rateLimits;
    } catch (error) {
      console.error('❌ Failed to get active rate limits:', error);
      return [];
    }
  }

  /**
   * Wait for rate limit to clear (with timeout)
   */
  static async waitForRateLimit(provider: string, modelId: string, maxWaitSeconds: number = 120): Promise<boolean> {
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;

    console.log(`⏳ Waiting for rate limit to clear for ${provider}:${modelId} (max ${maxWaitSeconds}s)`);

    while (Date.now() - startTime < maxWaitMs) {
      const rateLimitInfo = await this.checkRateLimit(provider, modelId);
      
      if (!rateLimitInfo.isRateLimited) {
        console.log(`✅ Rate limit cleared for ${provider}:${modelId}`);
        return true;
      }

      const waitTime = Math.min(5000, rateLimitInfo.secondsRemaining * 1000); // Wait up to 5 seconds at a time
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    console.log(`⏰ Timeout waiting for rate limit to clear for ${provider}:${modelId}`);
    return false;
  }

  /**
   * Handle rate limit error and set timeout
   */
  static async handleRateLimitError(error: any, provider: string, modelId: string): Promise<RateLimitError> {
    const retryAfter = this.extractRetryAfter(error);
    await this.setRateLimit(provider, modelId, retryAfter);
    
    return new RateLimitError(
      `Rate limit exceeded for ${provider}:${modelId}. Retry in ${retryAfter || RATE_LIMIT_TIMEOUT_SECONDS} seconds.`,
      provider,
      modelId,
      retryAfter
    );
  }
}

// Export utility functions
export const rateLimitManager = RateLimitManager;