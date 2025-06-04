import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { modelId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const youtubeModel = await prisma.youTubeAPIModel.findUnique({
      where: { modelId: params.modelId },
    });

    if (!youtubeModel) {
      return NextResponse.json({ error: 'YouTube API model not found' }, { status: 404 });
    }

    return NextResponse.json(youtubeModel);
  } catch (error) {
    console.error('Error fetching YouTube API model:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { modelId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      displayName,
      description,
      apiKey,
      maxResults,
      quotaLimit,
      searchFilters,
      isActive,
    } = body;

    // Check if model exists
    const existingModel = await prisma.youTubeAPIModel.findUnique({
      where: { modelId: params.modelId },
    });

    if (!existingModel) {
      return NextResponse.json({ error: 'YouTube API model not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    
    if (displayName !== undefined) updateData.displayName = displayName;
    if (description !== undefined) updateData.description = description;
    if (apiKey && apiKey.trim()) updateData.apiKey = apiKey;
    if (maxResults !== undefined) updateData.maxResults = maxResults;
    if (quotaLimit !== undefined) updateData.quotaLimit = quotaLimit;
    if (searchFilters !== undefined) updateData.searchFilters = searchFilters;
    if (isActive !== undefined) updateData.isActive = isActive;

    const youtubeModel = await prisma.youTubeAPIModel.update({
      where: { modelId: params.modelId },
      data: updateData,
    });

    return NextResponse.json(youtubeModel);
  } catch (error) {
    console.error('Error updating YouTube API model:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { modelId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if model exists
    const existingModel = await prisma.youTubeAPIModel.findUnique({
      where: { modelId: params.modelId },
    });

    if (!existingModel) {
      return NextResponse.json({ error: 'YouTube API model not found' }, { status: 404 });
    }

    await prisma.youTubeAPIModel.delete({
      where: { modelId: params.modelId },
    });

    return NextResponse.json({ message: 'YouTube API model deleted successfully' });
  } catch (error) {
    console.error('Error deleting YouTube API model:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}