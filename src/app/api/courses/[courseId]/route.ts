import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { CourseStatus } from '@prisma/client';

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

    // First check if course exists and user is enrolled
    const courseEnrollment = await prisma.courseEnrollment.findFirst({
      where: {
        courseId: courseId,
        user: {
          clerkUserId: userId,
        },
      },
    });

    // Get the course first
    const course = await prisma.course.findUnique({
      where: { 
        courseId: courseId,
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        sections: {
          include: {
            articles: {
              select: {
                articleId: true,
                title: true,
                description: true,
                orderIndex: true,
                isGenerated: true,
                generatedAt: true,
              },
              orderBy: {
                orderIndex: 'asc',
              },
            },
            quizzes: {
              select: {
                quizId: true,
                title: true,
                description: true,
                _count: {
                  select: {
                    questions: true,
                  },
                },
              },
            },
          },
          orderBy: {
            orderIndex: 'asc',
          },
        },
        enrollments: {
          where: {
            user: {
              clerkUserId: userId,
            },
          },
          include: {
            progress: {
              orderBy: {
                lastAccessedAt: 'desc',
              },
            },
          },
        },
        _count: {
          select: {
            enrollments: true,
            certificates: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Check access permissions: allow if course is published OR user is enrolled
    const isPublished = course.status === CourseStatus.PUBLISHED;
    const isEnrolled = courseEnrollment !== null;
    
    if (!isPublished && !isEnrolled) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Calculate progress metrics
    const totalArticles = course.sections.reduce((sum, section) => sum + section.articles.length, 0);
    const generatedArticles = course.sections.reduce(
      (sum, section) => sum + section.articles.filter(article => article.isGenerated).length,
      0
    );

    const enrollment = course.enrollments[0];
    let progressPercentage = 0;
    let completedArticles = 0;
    let quizAttempts: Record<string, { score: number; passed: boolean; completedAt: string }[]> = {};

    if (enrollment) {
      completedArticles = enrollment.progress.filter(p => p.isCompleted).length;
      progressPercentage = totalArticles > 0 ? Math.round((completedArticles / totalArticles) * 100) : 0;

      // Get quiz attempts for this user and course
      const attempts = await prisma.courseQuizAttempt.findMany({
        where: {
          clerkUserId: userId,
          quiz: {
            OR: [
              { courseId: course.courseId },
              { sectionId: { in: course.sections.map(s => s.sectionId) } },
              { articleId: { in: course.sections.flatMap(s => s.articles.map(a => a.articleId)) } },
            ],
          },
        },
        include: {
          quiz: {
            select: {
              quizId: true,
              articleId: true,
              sectionId: true,
              courseId: true,
            },
          },
        },
        orderBy: {
          completedAt: 'desc',
        },
      });

      // Group attempts by article ID (for easier lookup in the UI)
      const quizAttemptsByArticle: Record<string, { score: number; passed: boolean; completedAt: string }[]> = {};
      
      attempts.forEach(attempt => {
        if (attempt.quiz.articleId) {
          if (!quizAttemptsByArticle[attempt.quiz.articleId]) {
            quizAttemptsByArticle[attempt.quiz.articleId] = [];
          }
          quizAttemptsByArticle[attempt.quiz.articleId].push({
            score: attempt.score,
            passed: attempt.passed,
            completedAt: attempt.completedAt?.toISOString() || '',
          });
        }
      });

      // Sort attempts by score (highest first)
      Object.keys(quizAttemptsByArticle).forEach(articleId => {
        quizAttemptsByArticle[articleId].sort((a, b) => b.score - a.score);
      });

      quizAttempts = quizAttemptsByArticle;
    }

    const courseWithMetrics = {
      courseId: course.courseId,
      title: course.title,
      slug: course.slug,
      description: course.description,
      level: course.level,
      status: course.status,
      estimatedHours: course.estimatedHours,
      passMarkPercentage: course.passMarkPercentage,
      createdAt: course.createdAt,
      publishedAt: course.publishedAt,
      createdBy: course.createdBy,
      sections: course.sections.map(section => ({
        sectionId: section.sectionId,
        title: section.title,
        description: section.description,
        orderIndex: section.orderIndex,
        articles: section.articles,
        quizzes: section.quizzes,
      })),
      totalSections: course.sections.length,
      totalArticles,
      generatedArticles,
      enrollmentCount: course._count.enrollments,
      certificateCount: course._count.certificates,
      isEnrolled: course.enrollments.length > 0,
      enrolledAt: enrollment?.enrolledAt || null,
      isCompleted: enrollment?.completedAt !== null,
      completedAt: enrollment?.completedAt || null,
      progressPercentage,
      completedArticles,
      progress: enrollment?.progress || [],
      quizAttempts,
    };

    return NextResponse.json(courseWithMetrics);
  } catch (error) {
    console.error('Error fetching course:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}