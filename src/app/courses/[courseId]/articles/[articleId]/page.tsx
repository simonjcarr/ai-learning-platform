import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import CourseArticleContent from './course-article-content';

interface PageProps {
  params: Promise<{ courseId: string; articleId: string }>;
}


export default async function CourseArticlePage({ params }: PageProps) {
  const { courseId, articleId } = await params;
  
  const courseArticle = await prisma.courseArticle.findUnique({
    where: { articleId },
    include: {
      section: {
        include: {
          course: {
            select: {
              courseId: true,
              title: true,
              slug: true,
              level: true,
            }
          }
        }
      }
    }
  });

  if (!courseArticle) {
    notFound();
  }

  // Verify the article belongs to the requested course
  if (courseArticle.section.course.courseId !== courseId) {
    notFound();
  }

  return <CourseArticleContent courseArticle={courseArticle} courseId={courseId} />;
}