import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role, CourseGenerationStatus } from '@prisma/client';
import { addCourseGenerationToQueue } from '@/lib/bullmq';

export async function POST(
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
    const { sectionId } = body; // Optional: if provided, only generate content for articles in this section

    // Fetch the course with sections and articles
    const course = await prisma.course.findUnique({
      where: { courseId },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: {
            articles: {
              orderBy: { orderIndex: 'asc' },
              select: {
                articleId: true,
                title: true,
                description: true,
                isGenerated: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Filter articles based on sectionId if provided
    let articlesToGenerate: Array<{
      articleId: string;
      title: string;
      description?: string | null;
      sectionTitle: string;
      sectionDescription?: string | null;
    }> = [];

    if (sectionId) {
      // Generate content only for articles in the specified section
      const section = course.sections.find(s => s.sectionId === sectionId);
      if (!section) {
        return NextResponse.json({ error: 'Section not found' }, { status: 404 });
      }

      articlesToGenerate = section.articles
        .filter(article => !article.isGenerated) // Only generate content for articles that haven't been generated yet
        .map(article => ({
          articleId: article.articleId,
          title: article.title,
          description: article.description,
          sectionTitle: section.title,
          sectionDescription: section.description,
        }));
    } else {
      // Generate content for all articles in the course
      for (const section of course.sections) {
        const sectionArticles = section.articles
          .filter(article => !article.isGenerated) // Only generate content for articles that haven't been generated yet
          .map(article => ({
            articleId: article.articleId,
            title: article.title,
            description: article.description,
            sectionTitle: section.title,
            sectionDescription: section.description,
          }));
        
        articlesToGenerate.push(...sectionArticles);
      }
    }

    if (articlesToGenerate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All articles already have generated content',
        jobsQueued: 0,
      });
    }

    // Queue jobs for each article
    const jobIds: string[] = [];
    const context = {
      courseTitle: course.systemPromptTitle || course.title,
      courseDescription: course.systemPromptDescription || course.description,
      courseLevel: course.level,
    };

    for (const article of articlesToGenerate) {
      const jobData = {
        courseId,
        jobType: 'article_content' as const,
        articleId: article.articleId,
        context: {
          ...context,
          sectionTitle: article.sectionTitle,
          sectionDescription: article.sectionDescription,
          articleTitle: article.title,
          articleDescription: article.description,
        },
      };

      const job = await addCourseGenerationToQueue(jobData);
      if (job && job.id) {
        jobIds.push(job.id);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Queued ${jobIds.length} article${jobIds.length === 1 ? '' : 's'} for content generation`,
      jobsQueued: jobIds.length,
      jobIds,
      articlesQueued: articlesToGenerate.map(a => ({
        articleId: a.articleId,
        title: a.title,
      })),
    });
  } catch (error) {
    console.error('Error queueing bulk content generation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}