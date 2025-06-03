import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireAuth();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create default settings
    let settings = await prisma.courseCompletionSettings.findFirst({
      where: { settingsId: 'default' },
    });

    if (!settings) {
      settings = await prisma.courseCompletionSettings.create({
        data: { settingsId: 'default' },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to fetch course completion settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      bronzeThreshold,
      silverThreshold,
      goldThreshold,
      minEngagementScore,
      minQuizAverage,
      minArticlesCompletedPercent,
      finalExamRequired,
      finalExamCooldownHours,
    } = body;

    // Validate thresholds
    if (bronzeThreshold >= silverThreshold || silverThreshold >= goldThreshold) {
      return NextResponse.json(
        { error: 'Thresholds must be in ascending order: Bronze < Silver < Gold' },
        { status: 400 }
      );
    }

    if (bronzeThreshold < 0 || goldThreshold > 100) {
      return NextResponse.json(
        { error: 'Thresholds must be between 0 and 100' },
        { status: 400 }
      );
    }

    const settings = await prisma.courseCompletionSettings.upsert({
      where: { settingsId: 'default' },
      update: {
        bronzeThreshold,
        silverThreshold,
        goldThreshold,
        minEngagementScore,
        minQuizAverage,
        minArticlesCompletedPercent,
        finalExamRequired,
        finalExamCooldownHours,
        updatedAt: new Date(),
      },
      create: {
        settingsId: 'default',
        bronzeThreshold,
        silverThreshold,
        goldThreshold,
        minEngagementScore,
        minQuizAverage,
        minArticlesCompletedPercent,
        finalExamRequired,
        finalExamCooldownHours,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to update course completion settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}