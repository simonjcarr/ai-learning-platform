import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

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

    // Get current configuration from database
    let config = await prisma.bullMQConfig.findUnique({
      where: { configId: 'default' },
    });

    if (!config) {
      // Create default configuration
      config = await prisma.bullMQConfig.create({
        data: {
          configId: 'default',
          emailQueueAttempts: 3,
          emailQueueBackoffDelay: 2000,
          courseGenerationAttempts: 5,
          courseGenerationBackoffDelay: 10000,
          sitemapQueueAttempts: 2,
          sitemapQueueBackoffDelay: 5000,
          rateLimitRetrySeconds: 60,
          maxBackoffMinutes: 5,
        },
      });
    }

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Error fetching BullMQ config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const {
      emailQueueAttempts,
      emailQueueBackoffDelay,
      courseGenerationAttempts,
      courseGenerationBackoffDelay,
      sitemapQueueAttempts,
      sitemapQueueBackoffDelay,
      rateLimitRetrySeconds,
      maxBackoffMinutes,
    } = body;

    // Validate input
    const validatePositiveInteger = (value: any, field: string) => {
      if (typeof value !== 'number' || value <= 0 || !Number.isInteger(value)) {
        throw new Error(`${field} must be a positive integer`);
      }
    };

    validatePositiveInteger(emailQueueAttempts, 'Email queue attempts');
    validatePositiveInteger(emailQueueBackoffDelay, 'Email queue backoff delay');
    validatePositiveInteger(courseGenerationAttempts, 'Course generation attempts');
    validatePositiveInteger(courseGenerationBackoffDelay, 'Course generation backoff delay');
    validatePositiveInteger(sitemapQueueAttempts, 'Sitemap queue attempts');
    validatePositiveInteger(sitemapQueueBackoffDelay, 'Sitemap queue backoff delay');
    validatePositiveInteger(rateLimitRetrySeconds, 'Rate limit retry seconds');
    validatePositiveInteger(maxBackoffMinutes, 'Max backoff minutes');

    // Update configuration
    const config = await prisma.bullMQConfig.upsert({
      where: { configId: 'default' },
      create: {
        configId: 'default',
        emailQueueAttempts,
        emailQueueBackoffDelay,
        courseGenerationAttempts,
        courseGenerationBackoffDelay,
        sitemapQueueAttempts,
        sitemapQueueBackoffDelay,
        rateLimitRetrySeconds,
        maxBackoffMinutes,
      },
      update: {
        emailQueueAttempts,
        emailQueueBackoffDelay,
        courseGenerationAttempts,
        courseGenerationBackoffDelay,
        sitemapQueueAttempts,
        sitemapQueueBackoffDelay,
        rateLimitRetrySeconds,
        maxBackoffMinutes,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'BullMQ configuration updated successfully',
      config,
    });
  } catch (error) {
    console.error('Error updating BullMQ config:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}