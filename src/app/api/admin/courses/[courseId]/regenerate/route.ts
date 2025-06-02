import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role, CourseGenerationStatus } from '@prisma/client';
import { addCourseGenerationToQueue } from '@/lib/bullmq';

export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
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

    const body = await request.json();
    const { type, articleId, sectionId } = body;

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { courseId: params.courseId },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    let jobData: any = {
      courseId: params.courseId,
      context: {
        courseTitle: course.title,
        courseDescription: course.description,
        courseLevel: course.level,
      },
    };

    switch (type) {
      case 'outline':
        // Regenerate course outline
        await prisma.course.update({
          where: { courseId: params.courseId },
          data: {
            generationStatus: CourseGenerationStatus.PENDING,
            generationError: null,
          },
        });

        jobData.jobType = 'outline';
        break;

      case 'article_content':
        if (!articleId) {
          return NextResponse.json(
            { error: 'Article ID is required for article content generation' },
            { status: 400 }
          );
        }

        const article = await prisma.courseArticle.findUnique({
          where: { articleId },
          include: {
            section: true,
          },
        });

        if (!article) {
          return NextResponse.json({ error: 'Article not found' }, { status: 404 });
        }

        jobData.jobType = 'article_content';
        jobData.articleId = articleId;
        jobData.context = {
          ...jobData.context,
          sectionTitle: article.section.title,
          sectionDescription: article.section.description,
          articleTitle: article.title,
          articleDescription: article.description,
        };
        break;

      case 'quiz_generation':
        if (articleId) {
          // Generate quiz for specific article
          const article = await prisma.courseArticle.findUnique({
            where: { articleId },
            include: {
              section: true,
            },
          });

          if (!article) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 });
          }

          jobData.jobType = 'quiz_generation';
          jobData.articleId = articleId;
          jobData.context = {
            ...jobData.context,
            sectionTitle: article.section.title,
            articleTitle: article.title,
          };
        } else if (sectionId) {
          // Generate quiz for section
          const section = await prisma.courseSection.findUnique({
            where: { sectionId },
          });

          if (!section) {
            return NextResponse.json({ error: 'Section not found' }, { status: 404 });
          }

          jobData.jobType = 'quiz_generation';
          jobData.sectionId = sectionId;
          jobData.context = {
            ...jobData.context,
            sectionTitle: section.title,
          };
        } else {
          // Generate final exam for course
          jobData.jobType = 'quiz_generation';
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid regeneration type' },
          { status: 400 }
        );
    }

    // Queue the regeneration job
    const job = await addCourseGenerationToQueue(jobData);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: `${type} regeneration queued successfully`,
    });
  } catch (error) {
    console.error('Error queueing course regeneration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}