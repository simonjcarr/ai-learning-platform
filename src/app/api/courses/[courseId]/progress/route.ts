import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { articleId, isCompleted, timeSpent } = body;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { userId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is enrolled in the course
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: {
        courseId: params.courseId,
        userId: user.userId,
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 400 });
    }

    // Update or create progress entry
    const progress = await prisma.courseProgress.upsert({
      where: {
        enrollmentId_articleId: {
          enrollmentId: enrollment.enrollmentId,
          articleId: articleId,
        },
      },
      update: {
        isCompleted: isCompleted || false,
        timeSpent: { increment: timeSpent || 0 },
        ...(isCompleted && { completedAt: new Date() }),
        updatedAt: new Date(),
      },
      create: {
        enrollmentId: enrollment.enrollmentId,
        articleId: articleId,
        isCompleted: isCompleted || false,
        timeSpent: timeSpent || 0,
        ...(isCompleted && { completedAt: new Date() }),
      },
    });

    // Check if course is now complete
    const allProgress = await prisma.courseProgress.findMany({
      where: {
        enrollmentId: enrollment.enrollmentId,
      },
    });

    const totalArticles = allProgress.length;
    const completedArticles = allProgress.filter(p => p.isCompleted).length;
    const isAllComplete = totalArticles > 0 && completedArticles === totalArticles;

    // Update enrollment completion status if needed
    if (isAllComplete && !enrollment.completedAt) {
      await prisma.courseEnrollment.update({
        where: { enrollmentId: enrollment.enrollmentId },
        data: { completedAt: new Date() },
      });
    }

    const progressPercentage = totalArticles > 0 ? Math.round((completedArticles / totalArticles) * 100) : 0;

    return NextResponse.json({
      success: true,
      progress,
      courseCompleted: isAllComplete,
      progressPercentage,
      completedArticles,
      totalArticles,
    });
  } catch (error) {
    console.error('Error updating course progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}