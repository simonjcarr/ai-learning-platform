import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import CourseArticleContent from './course-article-content';

interface PageProps {
  params: Promise<{ courseId: string; articleId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { courseId, articleId } = await params;
  
  try {
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
                description: true,
                createdBy: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              }
            }
          }
        }
      }
    });

    if (!courseArticle || courseArticle.section.course.courseId !== courseId) {
      return {
        title: 'Course Article Not Found',
        description: 'The requested course article could not be found.',
      };
    }

    const course = courseArticle.section.course;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://yourdomain.com';
    const fullUrl = `${baseUrl}/courses/${courseId}/articles/${articleId}`;
    
    const title = `${courseArticle.title} - ${course.title} | IT Learning Platform`;
    const description = courseArticle.description 
      ? `${courseArticle.description} Part of the ${course.title} course (${course.level} level). Learn with hands-on examples and interactive content.`
      : `Learn ${courseArticle.title} as part of the comprehensive ${course.title} course. ${course.level} level content with practical examples.`;
    
    // Generate keywords from course and article content
    const keywords = [
      courseArticle.title.toLowerCase(),
      course.title.toLowerCase(),
      course.level.toLowerCase(),
      'course article',
      'tutorial',
      'learning',
      'IT training',
      courseArticle.section.title.toLowerCase(),
      'hands-on',
      'interactive'
    ];

    return {
      title,
      description,
      keywords: keywords.join(', '),
      authors: [{ name: `${course.createdBy.firstName} ${course.createdBy.lastName}` }],
      openGraph: {
        title,
        description,
        url: fullUrl,
        siteName: 'IT Learning Platform',
        type: 'article',
        publishedTime: courseArticle.generatedAt?.toISOString(),
        modifiedTime: courseArticle.updatedAt?.toISOString(),
        authors: [`${course.createdBy.firstName} ${course.createdBy.lastName}`],
        section: 'Education',
        tags: keywords,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        creator: `@${course.createdBy.firstName?.toLowerCase()}${course.createdBy.lastName?.toLowerCase()}`,
      },
      alternates: {
        canonical: fullUrl,
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
    };
  } catch (error) {
    console.error('Error generating course article metadata:', error);
    return {
      title: 'Course Article - IT Learning Platform',
      description: 'Comprehensive IT learning course article with hands-on examples and interactive content.',
    };
  }
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