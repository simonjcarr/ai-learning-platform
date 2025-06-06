import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import CourseDetailContent from "./course-detail-content";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { courseId } = await params;
  
  try {
    const course = await prisma.course.findFirst({
      where: { 
        courseId: courseId,
        deletedAt: null,
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        sections: {
          include: {
            articles: {
              select: {
                title: true,
                description: true,
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
      return {
        title: 'Course Not Found',
        description: 'The requested course could not be found.',
      };
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://yourdomain.com';
    const fullUrl = `${baseUrl}/courses/${courseId}`;
    
    const title = `${course.title} - ${course.level} Course | IT Learning Platform`;
    const description = `${course.description} Learn with ${course.sections.length} sections covering comprehensive topics. Created by ${course.createdBy.firstName} ${course.createdBy.lastName}.`;
    
    // Generate keywords from course content
    const keywords = [
      course.title.toLowerCase(),
      course.level.toLowerCase(),
      'course',
      'certification',
      'learning',
      'IT training',
      ...course.sections.flatMap(section => 
        section.articles.map(article => article.title.toLowerCase())
      ).slice(0, 10) // Limit to first 10 article titles
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
        publishedTime: course.publishedAt?.toISOString(),
        modifiedTime: course.updatedAt?.toISOString(),
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
    console.error('Error generating course metadata:', error);
    return {
      title: 'Course - IT Learning Platform',
      description: 'Comprehensive IT learning courses with hands-on projects and certifications.',
    };
  }
}

export default function CourseDetailPage({ params }: PageProps) {
  return <CourseDetailContent params={params} />;
}

