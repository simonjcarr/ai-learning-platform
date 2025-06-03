import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
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
    const { regenerateOnly = false } = body; // If true, only regenerate existing quizzes

    // Fetch the course with sections, articles, and existing quizzes
    const course = await prisma.course.findUnique({
      where: { courseId },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: {
            articles: {
              orderBy: { orderIndex: 'asc' },
              include: {
                quizzes: {
                  where: { quizType: 'article' },
                },
              },
            },
            quizzes: {
              where: { quizType: 'section' },
            },
          },
        },
        finalExams: {
          where: { quizType: 'final_exam' },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const context = {
      courseTitle: course.systemPromptTitle || course.title,
      courseDescription: course.systemPromptDescription || course.description,
      courseLevel: course.level,
    };

    const jobIds: string[] = [];
    const quizzesToGenerate: Array<{
      type: string;
      title: string;
      articleId?: string;
      sectionId?: string;
    }> = [];

    // Process articles
    for (const section of course.sections) {
      for (const article of section.articles) {
        // Skip if article has no content
        const articleWithContent = await prisma.courseArticle.findUnique({
          where: { articleId: article.articleId },
          select: { contentHtml: true },
        });

        if (!articleWithContent?.contentHtml) {
          continue;
        }

        // Check if we should generate quiz for this article
        const hasQuiz = article.quizzes.length > 0;
        if (!regenerateOnly || (regenerateOnly && hasQuiz)) {
          quizzesToGenerate.push({
            type: 'article',
            title: article.title,
            articleId: article.articleId,
          });

          const jobData = {
            courseId,
            jobType: 'quiz_generation' as const,
            articleId: article.articleId,
            context: {
              ...context,
              sectionTitle: section.title,
              sectionDescription: section.description,
              articleTitle: article.title,
              articleDescription: article.description,
            },
          };

          const job = await addCourseGenerationToQueue(jobData);
          if (job && job.id) {
            jobIds.push(job.id);
          }
        }
      }

      // Check if we should generate quiz for this section
      const sectionHasQuiz = section.quizzes.length > 0;
      const sectionHasArticlesWithContent = section.articles.some(async (article) => {
        const articleWithContent = await prisma.courseArticle.findUnique({
          where: { articleId: article.articleId },
          select: { contentHtml: true },
        });
        return articleWithContent?.contentHtml;
      });

      if (sectionHasArticlesWithContent && (!regenerateOnly || (regenerateOnly && sectionHasQuiz))) {
        quizzesToGenerate.push({
          type: 'section',
          title: section.title,
          sectionId: section.sectionId,
        });

        const jobData = {
          courseId,
          jobType: 'quiz_generation' as const,
          sectionId: section.sectionId,
          context: {
            ...context,
            sectionTitle: section.title,
            sectionDescription: section.description,
          },
        };

        const job = await addCourseGenerationToQueue(jobData);
        if (job && job.id) {
          jobIds.push(job.id);
        }
      }
    }

    // Check if we should generate final exam
    const hasFinalExam = course.finalExams.length > 0;
    const hasAnyContent = course.sections.some(section => 
      section.articles.length > 0
    );

    if (hasAnyContent && (!regenerateOnly || (regenerateOnly && hasFinalExam))) {
      quizzesToGenerate.push({
        type: 'final_exam',
        title: `${course.title} - Final Exam`,
      });

      const jobData = {
        courseId,
        jobType: 'quiz_generation' as const,
        context,
      };

      const job = await addCourseGenerationToQueue(jobData);
      if (job && job.id) {
        jobIds.push(job.id);
      }
    }

    if (jobIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: regenerateOnly 
          ? 'No existing quizzes to regenerate' 
          : 'No content available to generate quizzes',
        jobsQueued: 0,
      });
    }

    return NextResponse.json({
      success: true,
      message: regenerateOnly
        ? `Queued ${jobIds.length} quiz${jobIds.length === 1 ? '' : 'zes'} for regeneration`
        : `Queued ${jobIds.length} quiz${jobIds.length === 1 ? '' : 'zes'} for generation`,
      jobsQueued: jobIds.length,
      jobIds,
      quizzesQueued: quizzesToGenerate,
    });
  } catch (error) {
    console.error('Error queueing bulk quiz generation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}