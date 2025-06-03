import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

interface EngagementScore {
  articleEngagement: number;
  quizPerformance: number;
  timeInvestment: number;
  interactionQuality: number;
  finalScore: number;
}

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

    const engagementScore = await calculateEngagementScore(enrollment.enrollmentId, courseId, userId);

    return NextResponse.json(engagementScore);
  } catch (error) {
    console.error('Error calculating engagement score:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function calculateEngagementScore(
  enrollmentId: string,
  courseId: string,
  clerkUserId: string
): Promise<EngagementScore> {
  // Get all progress for user in course
  const progress = await prisma.courseProgress.findMany({
    where: { enrollmentId },
    include: { 
      article: {
        select: {
          title: true,
          contentHtml: true,
        },
      },
    },
  });

  // Get course details
  const course = await prisma.course.findUnique({
    where: { courseId },
    include: {
      sections: {
        include: {
          articles: {
            select: {
              articleId: true,
              title: true,
              contentHtml: true,
            },
          },
        },
      },
    },
  });

  if (!course) {
    throw new Error('Course not found');
  }

  // Get quiz performance
  const quizzes = await prisma.courseQuizAttempt.findMany({
    where: { 
      quiz: { 
        OR: [
          { courseId },
          { 
            section: { 
              courseId 
            }
          },
          {
            article: {
              section: {
                courseId
              }
            }
          }
        ]
      },
      clerkUserId: clerkUserId 
    },
    include: {
      quiz: {
        select: {
          quizType: true,
          passMarkPercentage: true,
        },
      },
    },
  });

  // Get interaction data
  // Note: ChatMessage and Comment models are related to general Article model, not CourseArticle
  // For course engagement, we'll use an empty array for now as course articles don't have chat/comments
  const chatMessages: any[] = [];
  const comments: any[] = [];

  // Calculate each component
  const articleScore = calculateArticleEngagement(progress, course);
  const quizScore = calculateQuizPerformance(quizzes);
  const timeScore = calculateTimeInvestment(progress);
  const interactionScore = calculateInteractions(chatMessages, comments, progress);

  // Weighted final score
  const finalScore = 
    (articleScore * 0.40) +
    (quizScore * 0.35) +
    (timeScore * 0.15) +
    (interactionScore * 0.10);

  return { 
    articleEngagement: Math.round(articleScore * 100) / 100,
    quizPerformance: Math.round(quizScore * 100) / 100,
    timeInvestment: Math.round(timeScore * 100) / 100,
    interactionQuality: Math.round(interactionScore * 100) / 100,
    finalScore: Math.round(finalScore * 100) / 100,
  };
}

function calculateArticleEngagement(progress: any[], course: any): number {
  if (progress.length === 0) return 0;

  let totalScore = 0;
  let articleCount = 0;

  for (const progressItem of progress) {
    if (!progressItem.article?.contentHtml) continue;

    articleCount++;
    const contentLength = progressItem.article.contentHtml.length;
    const expectedTime = Math.max(3, Math.ceil(contentLength / 1000) * 2); // 2 minutes per 1000 chars, min 3 min

    // Time component (50% of article score)
    const timeScore = progressItem.timeSpent >= expectedTime ? 0.5 : (progressItem.timeSpent / expectedTime) * 0.5;

    // Scroll component (50% of article score)
    const scrollScore = progressItem.scrollPercentage >= 80 ? 0.5 : (progressItem.scrollPercentage / 80) * 0.5;

    const articleScore = (timeScore + scrollScore) * 100;
    totalScore += articleScore;
  }

  return articleCount > 0 ? totalScore / articleCount : 0;
}

function calculateQuizPerformance(quizzes: any[]): number {
  if (quizzes.length === 0) return 0;

  // Separate by quiz type
  const sectionQuizzes = quizzes.filter(q => q.quiz.quizType === 'section');
  const articleQuizzes = quizzes.filter(q => q.quiz.quizType === 'article');
  const finalExams = quizzes.filter(q => q.quiz.quizType === 'final_exam');

  let totalScore = 0;
  let quizWeight = 0;

  // Section quizzes (required, 70% weight)
  if (sectionQuizzes.length > 0) {
    const sectionAverage = sectionQuizzes.reduce((sum, quiz) => sum + (quiz.score || 0), 0) / sectionQuizzes.length;
    totalScore += sectionAverage * 0.7;
    quizWeight += 0.7;
  }

  // Article quizzes (optional, 20% weight if taken)
  if (articleQuizzes.length > 0) {
    const articleAverage = articleQuizzes.reduce((sum, quiz) => sum + (quiz.score || 0), 0) / articleQuizzes.length;
    totalScore += articleAverage * 0.2;
    quizWeight += 0.2;
  }

  // Final exam (10% weight for engagement, main score tracked separately)
  if (finalExams.length > 0) {
    const finalAverage = finalExams.reduce((sum, quiz) => sum + (quiz.score || 0), 0) / finalExams.length;
    totalScore += finalAverage * 0.1;
    quizWeight += 0.1;
  }

  return quizWeight > 0 ? Math.min(totalScore / quizWeight * 100, 100) : 0;
}

function calculateTimeInvestment(progress: any[]): number {
  if (progress.length === 0) return 0;

  let totalTimeScore = 0;
  let articleCount = 0;

  for (const progressItem of progress) {
    if (!progressItem.article?.contentHtml) continue;

    articleCount++;
    const contentLength = progressItem.article.contentHtml.length;
    const expectedTime = Math.max(4, Math.ceil(contentLength / 800) * 3); // 3 minutes per 800 chars

    // Time investment score (diminishing returns after expected time)
    let timeScore;
    if (progressItem.timeSpent >= expectedTime) {
      timeScore = 100;
    } else {
      timeScore = (progressItem.timeSpent / expectedTime) * 100;
    }

    totalTimeScore += timeScore;
  }

  return articleCount > 0 ? totalTimeScore / articleCount : 0;
}

function calculateInteractions(chatMessages: any[], comments: any[], progress: any[]): number {
  const totalInteractions = chatMessages.length + comments.length;
  const totalArticles = progress.length;

  if (totalArticles === 0) return 0;

  // Base score from interactions per article
  const interactionsPerArticle = totalInteractions / totalArticles;
  
  // Score based on interaction density
  let interactionScore = 0;
  if (interactionsPerArticle >= 2) {
    interactionScore = 100; // Excellent interaction
  } else if (interactionsPerArticle >= 1) {
    interactionScore = 80; // Good interaction
  } else if (interactionsPerArticle >= 0.5) {
    interactionScore = 60; // Moderate interaction
  } else if (interactionsPerArticle > 0) {
    interactionScore = 40; // Some interaction
  } else {
    interactionScore = 0; // No interaction
  }

  return interactionScore;
}