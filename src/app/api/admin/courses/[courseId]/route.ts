import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role, CourseLevel, CourseStatus } from '@prisma/client';
import { addCourseGenerationToQueue } from '@/lib/bullmq';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { courseId } = await params;
    
    const course = await prisma.course.findUnique({
      where: { courseId },
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
              include: {
                quizzes: {
                  include: {
                    questions: true,
                    attempts: true,
                  },
                },
              },
            },
            quizzes: {
              include: {
                questions: true,
                attempts: true,
              },
            },
          },
          orderBy: {
            orderIndex: 'asc',
          },
        },
        enrollments: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            progress: true,
          },
        },
        certificates: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { courseId } = await params;
    const body = await request.json();
    const { title, description, level, estimatedHours, passMarkPercentage, status } = body;

    // Check if course exists
    const existingCourse = await prisma.course.findUnique({
      where: { courseId },
    });

    if (!existingCourse) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Validate level if provided
    if (level && !Object.values(CourseLevel).includes(level)) {
      return NextResponse.json(
        { error: 'Invalid course level' },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status && !Object.values(CourseStatus).includes(status)) {
      return NextResponse.json(
        { error: 'Invalid course status' },
        { status: 400 }
      );
    }

    // Generate new slug if title changed
    let slug = existingCourse.slug;
    if (title && title !== existingCourse.title) {
      slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Check if new slug already exists
      const slugExists = await prisma.course.findFirst({
        where: {
          slug,
          courseId: { not: courseId },
        },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: 'A course with this title already exists' },
          { status: 400 }
        );
      }
    }

    // Update the course
    const updatedCourse = await prisma.course.update({
      where: { courseId },
      data: {
        ...(title && { title, slug }),
        ...(description && { description }),
        ...(level && { level }),
        ...(estimatedHours !== undefined && { estimatedHours }),
        ...(passMarkPercentage !== undefined && { passMarkPercentage }),
        ...(status && { status }),
        ...(status === CourseStatus.PUBLISHED && { publishedAt: new Date() }),
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(updatedCourse);
  } catch (error) {
    console.error('Error updating course:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { courseId } = await params;
    
    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { courseId },
      include: {
        enrollments: true,
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Check if course has enrollments
    if (course.enrollments.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete course with existing enrollments' },
        { status: 400 }
      );
    }

    // Delete the course (cascade will handle sections, articles, etc.)
    await prisma.course.delete({
      where: { courseId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting course:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}