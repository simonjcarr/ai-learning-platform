import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import MarkdownViewer from '@/components/markdown-viewer';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import CourseQuiz from '@/components/course-quiz';

interface PageProps {
  params: Promise<{ courseId: string; articleId: string }>;
}

// Helper function to clean markdown content from AI-generated code blocks
function cleanMarkdownContent(content: string): string {
  let cleaned = content.trim();
  
  // Remove markdown code block wrappers if present
  if (cleaned.startsWith('```markdown\n') && cleaned.endsWith('\n```')) {
    cleaned = cleaned.slice(12, -4).trim();
  } else if (cleaned.startsWith('```\n') && cleaned.endsWith('\n```')) {
    cleaned = cleaned.slice(4, -4).trim();
  } else if (cleaned.startsWith('```markdown') && cleaned.endsWith('```')) {
    cleaned = cleaned.slice(11, -3).trim();
  } else if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
    cleaned = cleaned.slice(3, -3).trim();
  }
  
  return cleaned;
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Navigation */}
      <div className="mb-6">
        <Link href={`/courses/${courseId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Course
          </Button>
        </Link>
      </div>

      {/* Course Context */}
      <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
        <div className="flex items-center space-x-2 text-sm text-blue-700">
          <BookOpen className="h-4 w-4" />
          <span>{courseArticle.section.course.title}</span>
          <span>•</span>
          <span>{courseArticle.section.title}</span>
        </div>
      </Card>

      {/* Article Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {courseArticle.title}
        </h1>
        {courseArticle.description && (
          <p className="text-lg text-gray-600 mb-4">
            {courseArticle.description}
          </p>
        )}
        {courseArticle.generatedAt && (
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="h-4 w-4 mr-1" />
            Generated on {new Date(courseArticle.generatedAt).toLocaleDateString()}
          </div>
        )}
      </header>

      {/* Article Content */}
      <article className="prose prose-lg max-w-none">
        {courseArticle.contentHtml ? (
          <MarkdownViewer content={cleanMarkdownContent(courseArticle.contentHtml)} />
        ) : (
          <Card className="p-8 text-center">
            <div className="text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Content Being Generated</h3>
              <p>This article's content is currently being generated. Please check back in a few minutes.</p>
            </div>
          </Card>
        )}
      </article>

      {/* Course Quizzes */}
      {courseArticle.contentHtml && (
        <CourseQuiz articleId={courseArticle.articleId} />
      )}

      {/* Navigation to next/previous articles could be added here */}
    </div>
  );
}