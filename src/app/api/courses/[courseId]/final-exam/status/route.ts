import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { calculateEngagementScore } from '../../engagement/route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { courseId } = await params;

    // Get user and enrollment
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const enrollment = await prisma.courseEnrollment.findFirst({
      where: {
        courseId,
        clerkUserId: userId,
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled in course' }, { status: 400 });
    }

    // Get course with completion requirements
    const course = await prisma.course.findUnique({
      where: { courseId },
      include: {
        sections: {
          include: {
            articles: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get completion settings
    const settings = await prisma.courseCompletionSettings.findFirst({
      where: { settingsId: 'default' },
    });

    // Calculate course progress
    const totalArticles = course.sections.reduce((sum, section) => sum + section.articles.length, 0);
    const progress = await prisma.courseProgress.findMany({
      where: { enrollmentId: enrollment.enrollmentId },
    });
    const completedArticles = progress.filter(p => p.isCompleted).length;
    const courseProgress = totalArticles > 0 ? (completedArticles / totalArticles) * 100 : 0;

    // Calculate engagement score
    const engagementData = await calculateEngagementScore(enrollment.enrollmentId, courseId, userId);

    // Check section quiz average
    const sectionQuizzes = await prisma.courseQuizAttempt.findMany({
      where: {
        clerkUserId: userId,
        quiz: {
          sectionId: { not: null },
          section: { courseId },
        },
      },
    });

    const sectionQuizAverage = sectionQuizzes.length > 0 
      ? sectionQuizzes.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / sectionQuizzes.length 
      : 0;

    // Get previous final exam sessions
    const finalExamSessions = await prisma.finalExamSession.findMany({
      where: {
        courseId,
        clerkUserId: userId,
      },
      orderBy: { startedAt: 'desc' },
    });

    const bestScore = finalExamSessions.length > 0 
      ? Math.max(...finalExamSessions.map(s => s.score || 0))
      : null;

    const passed = finalExamSessions.some(s => s.passed === true);

    // Check cooldown
    const lastAttempt = finalExamSessions[0];
    let canTakeExam = true;
    let nextAttemptAt = null;
    let reason = '';

    // Check eligibility requirements
    const minArticlesPercent = settings?.minArticlesCompletedPercent ?? 85;
    const minEngagement = settings?.minEngagementScore ?? 75;
    const minQuizAverage = settings?.minQuizAverage ?? 70;

    if (courseProgress < minArticlesPercent) {
      canTakeExam = false;
      reason = `Complete at least ${minArticlesPercent}% of course articles (currently ${courseProgress.toFixed(1)}%)`;
    } else if (engagementData.finalScore < minEngagement) {
      canTakeExam = false;
      reason = `Achieve minimum engagement score of ${minEngagement}% (currently ${engagementData.finalScore}%)`;
    } else if (minQuizAverage > 0 && sectionQuizAverage < minQuizAverage) {
      // Only check quiz average if the requirement is greater than 0
      canTakeExam = false;
      reason = `Achieve minimum section quiz average of ${minQuizAverage}% (currently ${sectionQuizAverage.toFixed(1)}%)`;
    }

    // Check cooldown period
    if (canTakeExam && lastAttempt && !lastAttempt.passed && lastAttempt.canRetakeAt) {
      if (new Date() < lastAttempt.canRetakeAt) {
        canTakeExam = false;
        nextAttemptAt = lastAttempt.canRetakeAt.toISOString();
        const cooldownHours = settings?.finalExamCooldownHours ?? 24;
        reason = `Must wait ${cooldownHours} hours between failed exam attempts`;
      }
    }

    return NextResponse.json({
      canTake: canTakeExam,
      reason,
      nextAttemptAt,
      attempts: finalExamSessions.length,
      bestScore,
      passed,
      engagementScore: Math.round(engagementData.finalScore * 100) / 100,
      courseProgress: Math.round(courseProgress * 100) / 100,
    });
  } catch (error) {
    console.error('Error checking final exam status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}