import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
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

    const { courseId } = await params;

    // Get or create exam config for the course
    let examConfig = await prisma.courseExamConfig.findUnique({
      where: { courseId },
    });

    if (!examConfig) {
      // Create default config if it doesn't exist
      examConfig = await prisma.courseExamConfig.create({
        data: {
          courseId,
          questionBankSize: 125,
          essayQuestionsInBank: 10,
          examQuestionCount: 25,
          minEssayQuestions: 1,
          maxEssayQuestions: 2,
          examTimeLimit: 120,
        },
      });
    }

    return NextResponse.json(examConfig);
  } catch (error) {
    console.error('Error fetching course exam config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
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

    const { courseId } = await params;
    const data = await request.json();

    // Validate the data
    const {
      questionBankSize,
      essayQuestionsInBank,
      examQuestionCount,
      minEssayQuestions,
      maxEssayQuestions,
      examTimeLimit,
    } = data;

    // Basic validation
    if (questionBankSize < 1 || questionBankSize > 500) {
      return NextResponse.json({ error: 'Question bank size must be between 1 and 500' }, { status: 400 });
    }

    if (essayQuestionsInBank < 0 || essayQuestionsInBank > questionBankSize) {
      return NextResponse.json({ error: 'Essay questions in bank must be between 0 and total question bank size' }, { status: 400 });
    }

    if (examQuestionCount < 1 || examQuestionCount > questionBankSize) {
      return NextResponse.json({ error: 'Exam question count must be between 1 and question bank size' }, { status: 400 });
    }

    if (minEssayQuestions < 0 || minEssayQuestions > examQuestionCount) {
      return NextResponse.json({ error: 'Min essay questions must be between 0 and exam question count' }, { status: 400 });
    }

    if (maxEssayQuestions < minEssayQuestions || maxEssayQuestions > examQuestionCount) {
      return NextResponse.json({ error: 'Max essay questions must be between min essay questions and exam question count' }, { status: 400 });
    }

    if (examTimeLimit !== null && (examTimeLimit < 1 || examTimeLimit > 600)) {
      return NextResponse.json({ error: 'Exam time limit must be between 1 and 600 minutes' }, { status: 400 });
    }

    // Update or create the exam config
    const examConfig = await prisma.courseExamConfig.upsert({
      where: { courseId },
      update: {
        questionBankSize,
        essayQuestionsInBank,
        examQuestionCount,
        minEssayQuestions,
        maxEssayQuestions,
        examTimeLimit,
      },
      create: {
        courseId,
        questionBankSize,
        essayQuestionsInBank,
        examQuestionCount,
        minEssayQuestions,
        maxEssayQuestions,
        examTimeLimit,
      },
    });

    return NextResponse.json(examConfig);
  } catch (error) {
    console.error('Error updating course exam config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}