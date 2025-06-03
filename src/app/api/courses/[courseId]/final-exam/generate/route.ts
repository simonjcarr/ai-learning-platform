import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { addCourseGenerationToQueue } from '@/lib/bullmq';
import { calculateEngagementScore } from '../../engagement/route';

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

    // Check eligibility requirements
    const minArticlesPercent = settings?.minArticlesCompletedPercent ?? 85;
    const minEngagement = settings?.minEngagementScore ?? 75;
    const minQuizAverage = settings?.minQuizAverage ?? 70;

    let canTakeExam = true;
    let reason = '';

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

    if (!canTakeExam) {
      return NextResponse.json({ 
        error: 'Not eligible to take final exam',
        reason 
      }, { status: 400 });
    }

    // Check if final exam already exists for this course
    let finalExam = await prisma.courseQuiz.findFirst({
      where: {
        courseId,
        quizType: 'final_exam',
      },
    });

    if (!finalExam) {
      // Generate final exam using the worker
      console.log(`Generating final exam for course ${courseId}`);
      
      await addCourseGenerationToQueue({
        courseId,
        jobType: 'quiz_generation',
        context: { examType: 'final_exam' },
      });

      // Wait a moment for the job to complete (in a real app, you might use polling)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if exam was created
      finalExam = await prisma.courseQuiz.findFirst({
        where: {
          courseId,
          quizType: 'final_exam',
        },
      });

      if (!finalExam) {
        return NextResponse.json({ 
          error: 'Final exam generation is in progress. Please try again in a moment.' 
        }, { status: 202 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      examId: finalExam.quizId,
      message: 'Final exam is ready' 
    });
  } catch (error) {
    console.error('Error generating final exam:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}