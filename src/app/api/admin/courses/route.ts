import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role, CourseLevel, CourseStatus } from '@prisma/client';
import { addCourseGenerationToQueue } from '@/lib/bullmq';

export async function GET() {
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

    const courses = await prisma.course.findMany({
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
                isGenerated: true,
              },
            },
          },
        },
        enrollments: {
          select: {
            enrollmentId: true,
          },
        },
        certificates: {
          select: {
            certificateId: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
            certificates: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Add calculated fields
    const coursesWithStats = courses.map(course => ({
      ...course,
      totalArticles: course.sections.reduce((acc, section) => acc + section.articles.length, 0),
      generatedArticles: course.sections.reduce(
        (acc, section) => acc + section.articles.filter(article => article.isGenerated).length, 
        0
      ),
      enrollmentCount: course._count.enrollments,
      certificateCount: course._count.certificates,
    }));

    return NextResponse.json(coursesWithStats);
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { title, description, level, estimatedHours, passMarkPercentage } = body;

    // Validate required fields
    if (!title || !description || !level) {
      return NextResponse.json(
        { error: 'Title, description, and level are required' },
        { status: 400 }
      );
    }

    // Validate level
    if (!Object.values(CourseLevel).includes(level)) {
      return NextResponse.json(
        { error: 'Invalid course level' },
        { status: 400 }
      );
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check if slug already exists
    const existingCourse = await prisma.course.findUnique({
      where: { slug },
    });

    if (existingCourse) {
      return NextResponse.json(
        { error: 'A course with this title already exists' },
        { status: 400 }
      );
    }

    // Create the course
    const course = await prisma.course.create({
      data: {
        title,
        slug,
        description,
        level,
        estimatedHours: estimatedHours || null,
        passMarkPercentage: passMarkPercentage || 70.0,
        createdByClerkId: userId,
        status: CourseStatus.DRAFT,
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

    // Queue the course outline generation
    await addCourseGenerationToQueue({
      courseId: course.courseId,
      jobType: 'outline',
      context: {
        courseTitle: title,
        courseDescription: description,
        courseLevel: level,
      },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error('Error creating course:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}