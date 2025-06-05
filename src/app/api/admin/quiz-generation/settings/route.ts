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
    let settings = await prisma.quizGenerationSettings.findFirst({
      where: { settingsId: 'default' },
    });

    if (!settings) {
      settings = await prisma.quizGenerationSettings.create({
        data: { settingsId: 'default' },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to fetch quiz generation settings:', error);
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
      articleQuizMinQuestions,
      articleQuizMaxQuestions,
      sectionQuizMinQuestions,
      sectionQuizMaxQuestions,
      finalExamMinQuestions,
      finalExamMaxQuestions,
    } = body;

    // Validation
    const validateRange = (min: number, max: number, type: string): string | null => {
      if (min > max) {
        return `${type}: Minimum cannot be greater than maximum`;
      }
      if (min < 1) {
        return `${type}: Minimum must be at least 1`;
      }
      if (max > 500) {
        return `${type}: Maximum cannot exceed 500 questions`;
      }
      return null;
    };

    const errors: string[] = [];
    
    const articleError = validateRange(articleQuizMinQuestions, articleQuizMaxQuestions, "Article Quiz");
    if (articleError) errors.push(articleError);

    const sectionError = validateRange(sectionQuizMinQuestions, sectionQuizMaxQuestions, "Section Quiz");
    if (sectionError) errors.push(sectionError);

    const finalError = validateRange(finalExamMinQuestions, finalExamMaxQuestions, "Final Exam");
    if (finalError) errors.push(finalError);

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors.join('; ') },
        { status: 400 }
      );
    }

    const settings = await prisma.quizGenerationSettings.upsert({
      where: { settingsId: 'default' },
      update: {
        articleQuizMinQuestions,
        articleQuizMaxQuestions,
        sectionQuizMinQuestions,
        sectionQuizMaxQuestions,
        finalExamMinQuestions,
        finalExamMaxQuestions,
        updatedAt: new Date(),
      },
      create: {
        settingsId: 'default',
        articleQuizMinQuestions,
        articleQuizMaxQuestions,
        sectionQuizMinQuestions,
        sectionQuizMaxQuestions,
        finalExamMinQuestions,
        finalExamMaxQuestions,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to update quiz generation settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}