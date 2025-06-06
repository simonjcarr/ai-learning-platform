import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { CourseStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const status = searchParams.get('status') || 'published';

    // Build where clause
    const whereClause: any = {
      status: CourseStatus.PUBLISHED,
      deletedAt: null, // Only include non-deleted courses
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
                description: true,
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
        enrollments: userId ? {
          where: {
            clerkUserId: userId,
          },
          select: {
            enrollmentId: true,
            enrolledAt: true,
            completedAt: true,
          },
        } : false,
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

    // Get user from database (only if authenticated)
    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({
        where: { clerkUserId: userId },
        select: { clerkUserId: true },
      });
    }

    // Calculate additional metrics for each course
    const coursesWithMetrics = await Promise.all(
      courses.map(async (course) => {
        const totalArticles = course.sections.reduce((sum, section) => sum + section.articles.length, 0);
        const generatedArticles = course.sections.reduce(
          (sum, section) => sum + section.articles.filter(article => article.isGenerated).length,
          0
        );

        let progressPercentage = 0;
        let completedArticles = 0;
        let certificateId = null;

        // If user is enrolled, calculate progress and check for certificate
        if (course.enrollments.length > 0 && user) {
          const progress = await prisma.courseProgress.findMany({
            where: {
              enrollmentId: course.enrollments[0].enrollmentId,
            },
            select: {
              isCompleted: true,
            },
          });

          completedArticles = progress.filter(p => p.isCompleted).length;
          progressPercentage = totalArticles > 0 ? Math.round((completedArticles / totalArticles) * 100) : 0;

          // Check if user has a certificate for this course
          const certificate = await prisma.courseCertificate.findUnique({
            where: {
              courseId_clerkUserId: {
                courseId: course.courseId,
                clerkUserId: userId,
              },
            },
            select: {
              certificateId: true,
            },
          });

          if (certificate) {
            certificateId = certificate.certificateId;
          }
        }

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
          likesCount: course.likesCount,
          isEnrolled: course.enrollments.length > 0,
          enrolledAt: course.enrollments[0]?.enrolledAt || null,
          isCompleted: course.enrollments[0]?.completedAt !== null,
          completedAt: course.enrollments[0]?.completedAt || null,
          progressPercentage,
          completedArticles,
          certificateId,
        };
      })
    );

    return NextResponse.json(coursesWithMetrics);
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}