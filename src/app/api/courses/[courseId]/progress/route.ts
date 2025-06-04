import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { courseId } = await params;
    const body = await request.json();
    const { articleId, isCompleted, timeSpent, scrollPercentage } = body;

    console.log('📊 Progress API received:', {
      courseId,
      articleId,
      isCompleted,
      timeSpent,
      scrollPercentage,
      userId
    });

    // Calculate engagement score based on time spent and scroll percentage
    const calculateEngagementScore = (timeSpent: number, scrollPercentage: number, contentLength: number = 1000) => {
      // Expected time: 2 minutes per 1000 characters, minimum 3 minutes
      const expectedTime = Math.max(180, Math.ceil(contentLength / 1000) * 120); // 2 minutes per 1000 chars, min 3 min
      
      // Time component (50% of engagement score)
      const timeScore = timeSpent >= expectedTime ? 0.5 : (timeSpent / expectedTime) * 0.5;
      
      // Scroll component (50% of engagement score)
      const scrollScore = scrollPercentage >= 80 ? 0.5 : (scrollPercentage / 80) * 0.5;
      
      // Return score as percentage (0-100)
      return (timeScore + scrollScore) * 100;
    };

    // Get user info (just to verify user exists)
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { clerkUserId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is enrolled in the course
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: {
        courseId: courseId,
        clerkUserId: userId,
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 400 });
    }

    // Get article content to calculate engagement score
    const article = await prisma.courseArticle.findUnique({
      where: { articleId },
      select: { contentHtml: true },
    });

    const contentLength = article?.contentHtml?.length || 1000;
    const engagementScore = calculateEngagementScore(timeSpent || 0, scrollPercentage || 0, contentLength);

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
        timeSpent: timeSpent || 0, // Use absolute value, not increment
        scrollPercentage: scrollPercentage || 0,
        engagementScore: engagementScore,
        clerkUserId: userId,
        lastAccessedAt: new Date(),
        ...(isCompleted && { completedAt: new Date() }),
      },
      create: {
        enrollmentId: enrollment.enrollmentId,
        articleId: articleId,
        clerkUserId: userId,
        isCompleted: isCompleted || false,
        timeSpent: timeSpent || 0,
        scrollPercentage: scrollPercentage || 0,
        engagementScore: engagementScore,
        lastAccessedAt: new Date(),
        ...(isCompleted && { completedAt: new Date() }),
      },
    });

    console.log('💾 Progress saved to database:', {
      progressId: progress.progressId,
      isCompleted: progress.isCompleted,
      timeSpent: progress.timeSpent,
      scrollPercentage: progress.scrollPercentage,
      engagementScore: progress.engagementScore,
      completedAt: progress.completedAt
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