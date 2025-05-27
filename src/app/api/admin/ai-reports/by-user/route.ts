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

    // Get aggregated data by user (excluding null users for system operations)
    const data = await prisma.aIInteraction.groupBy({
      by: ['clerkUserId'],
      where: {
        ...dateFilter,
        clerkUserId: { not: null }
      },
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

    // Get user details
    const userIds = data.map(d => d.clerkUserId).filter(id => id !== null) as string[];
    const users = await prisma.user.findMany({
      where: { clerkUserId: { in: userIds } },
      select: {
        clerkUserId: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true
      }
    });

    const userMap = new Map(users.map(u => [u.clerkUserId, u]));

    // Format response
    const formattedData = data.map(item => {
      const userData = userMap.get(item.clerkUserId || '');
      const displayName = userData 
        ? (userData.username || 
           (userData.firstName && userData.lastName 
             ? `${userData.firstName} ${userData.lastName}` 
             : userData.email))
        : 'Unknown User';

      return {
        userId: item.clerkUserId,
        email: userData?.email || 'Unknown',
        displayName,
        interactions: item._count.interactionId,
        inputTokens: item._sum.inputTokens || 0,
        outputTokens: item._sum.outputTokens || 0,
        totalTokens: (item._sum.inputTokens || 0) + (item._sum.outputTokens || 0),
        inputCost: parseFloat(item._sum.inputTokenCost?.toString() || '0'),
        outputCost: parseFloat(item._sum.outputTokenCost?.toString() || '0'),
        totalCost: parseFloat(item._sum.totalCost?.toString() || '0')
      };
    });

    // Sort by total cost descending
    formattedData.sort((a, b) => b.totalCost - a.totalCost);

    return NextResponse.json({ data: formattedData });
  } catch (error) {
    console.error('Error fetching AI reports by user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI reports' },
      { status: 500 }
    );
  }
}