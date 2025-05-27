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

    // Get aggregated data by interaction type
    const data = await prisma.aIInteraction.groupBy({
      by: ['interactionTypeId'],
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

    // Get interaction type details
    const typeIds = data.map(d => d.interactionTypeId);
    const types = await prisma.aIInteractionType.findMany({
      where: { typeId: { in: typeIds } },
      select: {
        typeId: true,
        displayName: true,
        typeName: true
      }
    });

    const typeMap = new Map(types.map(t => [t.typeId, t]));

    // Format response
    const formattedData = data.map(item => ({
      typeId: item.interactionTypeId,
      typeName: typeMap.get(item.interactionTypeId)?.typeName || 'Unknown',
      displayName: typeMap.get(item.interactionTypeId)?.displayName || 'Unknown',
      interactions: item._count.interactionId,
      inputTokens: item._sum.inputTokens || 0,
      outputTokens: item._sum.outputTokens || 0,
      totalTokens: (item._sum.inputTokens || 0) + (item._sum.outputTokens || 0),
      inputCost: parseFloat(item._sum.inputTokenCost?.toString() || '0'),
      outputCost: parseFloat(item._sum.outputTokenCost?.toString() || '0'),
      totalCost: parseFloat(item._sum.totalCost?.toString() || '0')
    }));

    return NextResponse.json({ data: formattedData });
  } catch (error) {
    console.error('Error fetching AI reports by interaction type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI reports' },
      { status: 500 }
    );
  }
}