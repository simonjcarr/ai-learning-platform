import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { CourseStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const status = searchParams.get('status') || 'published';

    // Build where clause
    const whereClause: any = {
      status: CourseStatus.PUBLISHED,
    };

    if (level) {
      whereClause.level = level;
    }

    const courses = await prisma.course.findMany({
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
          select: {
            sectionId: true,
            title: true,
            description: true,
            orderIndex: true,
            articles: {
              select: {
                articleId: true,
                title: true,
                isGenerated: true,
              },
              orderBy: {
                orderIndex: 'asc',
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
          select: {
            enrollmentId: true,
            enrolledAt: true,
            completedAt: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
            certificates: true,
          },
        },
      },
      orderBy: [
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Calculate additional metrics for each course
    const coursesWithMetrics = courses.map(course => {
      const totalArticles = course.sections.reduce((sum, section) => sum + section.articles.length, 0);
      const generatedArticles = course.sections.reduce(
        (sum, section) => sum + section.articles.filter(article => article.isGenerated).length,
        0
      );

      return {
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
        totalSections: course.sections.length,
        totalArticles,
        generatedArticles,
        enrollmentCount: course._count.enrollments,
        certificateCount: course._count.certificates,
        isEnrolled: course.enrollments.length > 0,
        enrolledAt: course.enrollments[0]?.enrolledAt || null,
        isCompleted: course.enrollments[0]?.completedAt !== null,
        completedAt: course.enrollments[0]?.completedAt || null,
      };
    });

    return NextResponse.json(coursesWithMetrics);
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}