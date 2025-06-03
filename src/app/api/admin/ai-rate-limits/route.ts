import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { rateLimitManager } from '@/lib/rate-limit';

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

    // Get active rate limits from Redis
    const activeRateLimits = await rateLimitManager.getActiveRateLimits();

    // Get historical rate limit data from database
    const historicalRateLimits = await prisma.aIRateLimit.findMany({
      orderBy: { lastHitAt: 'desc' },
      take: 50, // Last 50 rate limit events
    });

    return NextResponse.json({
      success: true,
      activeRateLimits,
      historicalRateLimits,
      summary: {
        totalActiveRateLimits: activeRateLimits.length,
        totalHistoricalEvents: historicalRateLimits.length,
        currentlyLimitedProviders: [...new Set(activeRateLimits.map(rl => rl.provider))],
      },
    });
  } catch (error) {
    console.error('Error fetching rate limit data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const provider = searchParams.get('provider');
    const modelId = searchParams.get('modelId');
    const action = searchParams.get('action');

    if (action === 'clear-all') {
      // Clear all active rate limits
      const activeRateLimits = await rateLimitManager.getActiveRateLimits();
      
      for (const rateLimit of activeRateLimits) {
        await rateLimitManager.clearRateLimit(rateLimit.provider!, rateLimit.modelId!);
      }

      return NextResponse.json({
        success: true,
        message: `Cleared ${activeRateLimits.length} active rate limits`,
        clearedCount: activeRateLimits.length,
      });
    }

    if (provider && modelId) {
      // Clear specific rate limit
      await rateLimitManager.clearRateLimit(provider, modelId);

      return NextResponse.json({
        success: true,
        message: `Rate limit cleared for ${provider}:${modelId}`,
      });
    }

    return NextResponse.json(
      { error: 'Invalid parameters. Provide provider and modelId, or action=clear-all' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error clearing rate limits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}