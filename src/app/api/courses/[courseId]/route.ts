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

    const { courseId } = await params;

    // First check if course exists and user is enrolled (only if user is authenticated)
    let courseEnrollment = null;
    if (userId) {
      courseEnrollment = await prisma.courseEnrollment.findFirst({
        where: {
          courseId: courseId,
          user: {
            clerkUserId: userId,
          },
        },
      });
    }

    // Get the course - for unauthenticated users, only show published courses
    // For authenticated users, show any course they're enrolled in
    const whereClause: any = {
      courseId: courseId,
      deletedAt: null, // Only include non-deleted courses
    };
    
    // If user is not authenticated, only show published courses
    if (!userId) {
      whereClause.status = CourseStatus.PUBLISHED;
    }
    
    const course = await prisma.course.findFirst({
      where: whereClause,
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
        enrollments: userId ? {
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
        } : false,
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

    // For non-authenticated users, return basic course outline if published
    if (!userId && isPublished) {
      const courseOutline = {
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
          articles: section.articles.map(article => ({
            articleId: article.articleId,
            title: article.title,
            description: article.description,
            orderIndex: article.orderIndex,
            isGenerated: article.isGenerated,
          })),
          quizzes: section.quizzes,
        })),
        totalSections: course.sections.length,
        totalArticles: course.sections.reduce((sum, section) => sum + section.articles.length, 0),
        generatedArticles: course.sections.reduce(
          (sum, section) => sum + section.articles.filter(article => article.isGenerated).length,
          0
        ),
        enrollmentCount: course._count.enrollments,
        certificateCount: course._count.certificates,
        isEnrolled: false,
        enrolledAt: null,
        isCompleted: false,
        completedAt: null,
        progressPercentage: 0,
        completedArticles: 0,
        progress: [],
        quizAttempts: {},
      };
      return NextResponse.json(courseOutline);
    }

    // Calculate progress metrics
    const totalArticles = course.sections.reduce((sum, section) => sum + section.articles.length, 0);
    const generatedArticles = course.sections.reduce(
      (sum, section) => sum + section.articles.filter(article => article.isGenerated).length,
      0
    );

    const enrollment = course.enrollments && course.enrollments.length > 0 ? course.enrollments[0] : null;
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

      // Group attempts by article ID and section ID (for easier lookup in the UI)
      const quizAttemptsByArticle: Record<string, { score: number; passed: boolean; completedAt: string }[]> = {};
      const quizAttemptsBySection: Record<string, { score: number; passed: boolean; completedAt: string }[]> = {};
      
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
        } else if (attempt.quiz.sectionId) {
          if (!quizAttemptsBySection[attempt.quiz.sectionId]) {
            quizAttemptsBySection[attempt.quiz.sectionId] = [];
          }
          quizAttemptsBySection[attempt.quiz.sectionId].push({
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
      Object.keys(quizAttemptsBySection).forEach(sectionId => {
        quizAttemptsBySection[sectionId].sort((a, b) => b.score - a.score);
      });

      quizAttempts = { ...quizAttemptsByArticle, sections: quizAttemptsBySection };
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
      isEnrolled: course.enrollments && course.enrollments.length > 0,
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