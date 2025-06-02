import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { CourseStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First check if course exists and user is enrolled
    const courseEnrollment = await prisma.courseEnrollment.findFirst({
      where: {
        courseId: params.courseId,
        user: {
          clerkUserId: userId,
        },
      },
    });

    // Get the course first
    const course = await prisma.course.findUnique({
      where: { 
        courseId: params.courseId,
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
                updatedAt: 'desc',
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

    if (enrollment) {
      completedArticles = enrollment.progress.filter(p => p.isCompleted).length;
      progressPercentage = totalArticles > 0 ? Math.round((completedArticles / totalArticles) * 100) : 0;
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