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
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get or create question point settings
    let settings = await prisma.questionPointSettings.findFirst({
      where: { settingsId: 'default' },
    });

    if (!settings) {
      // Create default settings if they don't exist
      settings = await prisma.questionPointSettings.create({
        data: {
          settingsId: 'default',
          multipleChoicePoints: 1.0,
          trueFalsePoints: 1.0,
          fillInBlankPoints: 1.5,
          essayMinPoints: 2.0,
          essayMaxPoints: 5.0,
          essayPassingThreshold: 0.6,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching question point settings:', error);
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

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();

    // Validate the data
    const {
      multipleChoicePoints,
      trueFalsePoints,
      fillInBlankPoints,
      essayMinPoints,
      essayMaxPoints,
      essayPassingThreshold,
    } = data;

    // Basic validation
    if (multipleChoicePoints < 0.1 || multipleChoicePoints > 20) {
      return NextResponse.json({ error: 'Multiple choice points must be between 0.1 and 20' }, { status: 400 });
    }

    if (trueFalsePoints < 0.1 || trueFalsePoints > 20) {
      return NextResponse.json({ error: 'True/false points must be between 0.1 and 20' }, { status: 400 });
    }

    if (fillInBlankPoints < 0.1 || fillInBlankPoints > 20) {
      return NextResponse.json({ error: 'Fill in blank points must be between 0.1 and 20' }, { status: 400 });
    }

    if (essayMinPoints < 0.1 || essayMinPoints > 50) {
      return NextResponse.json({ error: 'Essay minimum points must be between 0.1 and 50' }, { status: 400 });
    }

    if (essayMaxPoints < essayMinPoints || essayMaxPoints > 50) {
      return NextResponse.json({ error: 'Essay maximum points must be between minimum points and 50' }, { status: 400 });
    }

    if (essayPassingThreshold < 0.1 || essayPassingThreshold > 1.0) {
      return NextResponse.json({ error: 'Essay passing threshold must be between 0.1 and 1.0' }, { status: 400 });
    }

    // Update or create the settings
    const settings = await prisma.questionPointSettings.upsert({
      where: { settingsId: 'default' },
      update: {
        multipleChoicePoints,
        trueFalsePoints,
        fillInBlankPoints,
        essayMinPoints,
        essayMaxPoints,
        essayPassingThreshold,
      },
      create: {
        settingsId: 'default',
        multipleChoicePoints,
        trueFalsePoints,
        fillInBlankPoints,
        essayMinPoints,
        essayMaxPoints,
        essayPassingThreshold,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating question point settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}