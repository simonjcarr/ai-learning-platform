import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { CourseStatus } from '@prisma/client';

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

    // Check if course exists and is published
    const course = await prisma.course.findUnique({
      where: { 
        courseId: courseId,
        status: CourseStatus.PUBLISHED,
      },
      include: {
        sections: {
          include: {
            articles: {
              select: {
                articleId: true,
                orderIndex: true,
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
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found or not available' }, { status: 404 });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is already enrolled
    const existingEnrollment = await prisma.courseEnrollment.findFirst({
      where: {
        courseId: courseId,
        clerkUserId: userId,
      },
    });

    if (existingEnrollment) {
      return NextResponse.json({ error: 'Already enrolled in this course' }, { status: 400 });
    }

    // Create enrollment and initialize progress tracking
    const result = await prisma.$transaction(async (tx) => {
      // Create enrollment
      const enrollment = await tx.courseEnrollment.create({
        data: {
          courseId: courseId,
          clerkUserId: userId,
          enrolledAt: new Date(),
        },
      });

      // Create progress entries for all articles
      const progressEntries = [];
      for (const section of course.sections) {
        for (const article of section.articles) {
          progressEntries.push({
            enrollmentId: enrollment.enrollmentId,
            articleId: article.articleId,
            clerkUserId: userId,
          });
        }
      }

      if (progressEntries.length > 0) {
        await tx.courseProgress.createMany({
          data: progressEntries,
        });
      }

      return enrollment;
    });

    return NextResponse.json({
      success: true,
      enrollmentId: result.enrollmentId,
      message: 'Successfully enrolled in course',
    });
  } catch (error) {
    console.error('Error enrolling in course:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}