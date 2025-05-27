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

    // Get aggregated data by model
    const data = await prisma.aIInteraction.groupBy({
      by: ['modelId'],
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

    // Get model details
    const modelIds = data.map(d => d.modelId);
    const models = await prisma.aIModel.findMany({
      where: { modelId: { in: modelIds } },
      select: {
        modelId: true,
        displayName: true,
        provider: true
      }
    });

    const modelMap = new Map(models.map(m => [m.modelId, m]));

    // Format response
    const formattedData = data.map(item => ({
      modelId: item.modelId,
      modelName: modelMap.get(item.modelId)?.displayName || 'Unknown',
      provider: modelMap.get(item.modelId)?.provider || 'Unknown',
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
    console.error('Error fetching AI reports by model:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI reports' },
      { status: 500 }
    );
  }
}