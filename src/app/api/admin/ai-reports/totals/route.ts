import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { Role } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true }
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'all';

    // Build date filter
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'hour':
        dateFilter = { startedAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } };
        break;
      case 'day':
        dateFilter = { startedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } };
        break;
      case 'week':
        dateFilter = { startedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case 'month':
        dateFilter = { startedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
        break;
      case 'year':
        dateFilter = { startedAt: { gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) } };
        break;
    }

    // Get total aggregated data
    const totals = await prisma.aIInteraction.aggregate({
      where: dateFilter,
      _sum: {
        inputTokens: true,
        outputTokens: true,
        inputTokenCost: true,
        outputTokenCost: true,
        totalCost: true
      },
      _count: {
        interactionId: true
      }
    });

    // Get success/failure counts
    const successCount = await prisma.aIInteraction.count({
      where: {
        ...dateFilter,
        isSuccessful: true
      }
    });

    const failureCount = await prisma.aIInteraction.count({
      where: {
        ...dateFilter,
        isSuccessful: false
      }
    });

    // Get average response time
    const avgDuration = await prisma.aIInteraction.aggregate({
      where: {
        ...dateFilter,
        durationMs: { not: null }
      },
      _avg: {
        durationMs: true
      }
    });

    // Get unique users count
    const uniqueUsers = await prisma.aIInteraction.findMany({
      where: {
        ...dateFilter,
        clerkUserId: { not: null }
      },
      select: {
        clerkUserId: true
      },
      distinct: ['clerkUserId']
    });

    // Format response
    const data = {
      totalInteractions: totals._count.interactionId,
      successfulInteractions: successCount,
      failedInteractions: failureCount,
      successRate: totals._count.interactionId > 0 
        ? (successCount / totals._count.interactionId * 100).toFixed(2) 
        : '0',
      uniqueUsers: uniqueUsers.length,
      totalInputTokens: totals._sum.inputTokens || 0,
      totalOutputTokens: totals._sum.outputTokens || 0,
      totalTokens: (totals._sum.inputTokens || 0) + (totals._sum.outputTokens || 0),
      totalInputCost: parseFloat(totals._sum.inputTokenCost?.toString() || '0'),
      totalOutputCost: parseFloat(totals._sum.outputTokenCost?.toString() || '0'),
      totalCost: parseFloat(totals._sum.totalCost?.toString() || '0'),
      averageResponseTime: avgDuration._avg.durationMs 
        ? Math.round(avgDuration._avg.durationMs) 
        : 0,
      averageCostPerInteraction: totals._count.interactionId > 0
        ? parseFloat((parseFloat(totals._sum.totalCost?.toString() || '0') / totals._count.interactionId).toFixed(4))
        : 0
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching AI report totals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI report totals' },
      { status: 500 }
    );
  }
}