import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = await prisma.suggestionSettings.findFirst();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching suggestion settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    
    const settings = await prisma.suggestionSettings.create({
      data: {
        rateLimitMinutes: data.rateLimitMinutes,
        maxSuggestionsPerUser: data.maxSuggestionsPerUser,
        badgeThresholds: data.badgeThresholds,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error creating suggestion settings:', error);
    return NextResponse.json(
      { error: 'Failed to create settings' },
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

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    
    const existingSettings = await prisma.suggestionSettings.findFirst();
    if (!existingSettings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    const settings = await prisma.suggestionSettings.update({
      where: { settingsId: existingSettings.settingsId },
      data: {
        rateLimitMinutes: data.rateLimitMinutes,
        maxSuggestionsPerUser: data.maxSuggestionsPerUser,
        badgeThresholds: data.badgeThresholds,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating suggestion settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}