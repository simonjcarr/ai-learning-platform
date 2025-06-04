import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export async function GET() {
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

    const youtubeModels = await prisma.youTubeAPIModel.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(youtubeModels);
  } catch (error) {
    console.error('Error fetching YouTube API models:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
      modelName,
      displayName,
      description,
      apiKey,
      maxResults,
      quotaLimit,
      searchFilters,
    } = body;

    // Validate required fields
    if (!modelName || !displayName || !apiKey) {
      return NextResponse.json(
        { error: 'Model name, display name, and API key are required' },
        { status: 400 }
      );
    }

    // Check if model name already exists
    const existingModel = await prisma.youTubeAPIModel.findUnique({
      where: { modelName },
    });

    if (existingModel) {
      return NextResponse.json(
        { error: 'A YouTube API model with this name already exists' },
        { status: 409 }
      );
    }

    const youtubeModel = await prisma.youTubeAPIModel.create({
      data: {
        modelName,
        displayName,
        description,
        apiKey,
        maxResults: maxResults || 5,
        quotaLimit: quotaLimit || 10000,
        searchFilters: searchFilters || {},
      },
    });

    return NextResponse.json(youtubeModel, { status: 201 });
  } catch (error) {
    console.error('Error creating YouTube API model:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}