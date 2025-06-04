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

    // Check if question bank exists for this course
    const questionBank = await prisma.finalExamQuestionBank.findMany({
      where: { courseId },
    });

    if (questionBank.length === 0) {
      // Generate question bank using the worker
      console.log(`Generating question bank for course ${courseId}`);
      
      await addCourseGenerationToQueue({
        courseId,
        jobType: 'final_exam_bank',
        context: {},
      });

      // Wait a moment for the job to complete (in a real app, you might use polling)
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if question bank was created
      const newQuestionBank = await prisma.finalExamQuestionBank.findMany({
        where: { courseId },
      });

      if (newQuestionBank.length === 0) {
        return NextResponse.json({ 
          error: 'Question bank generation is in progress. Please try again in a moment.' 
        }, { status: 202 });
      }
    }

    // Check cooldown period for previous attempts
    const lastAttempt = await prisma.finalExamSession.findFirst({
      where: {
        courseId,
        clerkUserId: userId,
      },
      orderBy: { startedAt: 'desc' },
    });

    if (lastAttempt && !lastAttempt.passed && lastAttempt.canRetakeAt && new Date() < lastAttempt.canRetakeAt) {
      return NextResponse.json({ 
        error: 'Must wait before retaking the exam',
        canRetakeAt: lastAttempt.canRetakeAt 
      }, { status: 400 });
    }

    // Create new exam session with 25 randomly selected questions
    const examSession = await createFinalExamSession(courseId, userId);

    return NextResponse.json({ 
      success: true, 
      sessionId: examSession.sessionId,
      message: 'Final exam session created' 
    });
  } catch (error) {
    console.error('Error generating final exam:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function createFinalExamSession(courseId: string, clerkUserId: string) {
  // Get all questions from the question bank
  const allQuestions = await prisma.finalExamQuestionBank.findMany({
    where: { courseId },
  });

  if (allQuestions.length < 25) {
    throw new Error('Insufficient questions in question bank');
  }

  // Separate essay and non-essay questions
  const essayQuestions = allQuestions.filter(q => q.questionType === 'ESSAY');
  const nonEssayQuestions = allQuestions.filter(q => q.questionType !== 'ESSAY');

  // Select 1-2 essay questions randomly
  const essayCount = Math.floor(Math.random() * 2) + 1; // 1 or 2 essays
  const selectedEssays = essayQuestions
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(essayCount, essayQuestions.length));

  // Select remaining questions from non-essay questions
  const remainingQuestions = 25 - selectedEssays.length;
  const selectedNonEssays = nonEssayQuestions
    .sort(() => Math.random() - 0.5)
    .slice(0, remainingQuestions);

  // Combine and shuffle all selected questions
  const selectedQuestions = [...selectedEssays, ...selectedNonEssays]
    .sort(() => Math.random() - 0.5);

  // Get completion settings for cooldown
  const settings = await prisma.courseCompletionSettings.findFirst({
    where: { settingsId: 'default' },
  });

  // Create exam session
  const examSession = await prisma.finalExamSession.create({
    data: {
      courseId,
      clerkUserId,
    },
  });

  // Create questions for this session
  for (let i = 0; i < selectedQuestions.length; i++) {
    await prisma.finalExamQuestion.create({
      data: {
        sessionId: examSession.sessionId,
        bankQuestionId: selectedQuestions[i].questionId,
        orderIndex: i,
      },
    });
  }

  console.log(`✅ Final exam session created for course ${courseId}, user ${clerkUserId} - ${selectedQuestions.length} questions (${selectedEssays.length} essays)`);
  
  return examSession;
}