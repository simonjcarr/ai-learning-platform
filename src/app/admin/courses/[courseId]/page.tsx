"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Role, CourseLevel, CourseStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, RefreshCw, Play, Users, Award, BookOpen, Clock, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CourseSection {
  sectionId: string;
  title: string;
  description?: string;
  orderIndex: number;
  articles: Array<{
    articleId: string;
    title: string;
    description?: string;
    orderIndex: number;
    isGenerated: boolean;
    generatedAt?: string;
    quizzes: Array<{
      quizId: string;
      title: string;
      questions: any[];
      attempts: any[];
    }>;
  }>;
  quizzes: Array<{
    quizId: string;
    title: string;
    questions: any[];
    attempts: any[];
  }>;
}

interface Course {
  courseId: string;
  title: string;
  slug: string;
  description: string;
  level: CourseLevel;
  status: CourseStatus;
  estimatedHours?: number;
  passMarkPercentage: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  generationStatus: string;
  generationError?: string;
  courseOutlineJson?: any;
  createdBy: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  sections: CourseSection[];
  enrollments: Array<{
    enrollmentId: string;
    enrolledAt: string;
    completedAt?: string;
    user: {
      firstName?: string;
      lastName?: string;
      email: string;
    };
    progress: any[];
  }>;
  certificates: Array<{
    certificateId: string;
    issuedAt: string;
    user: {
      firstName?: string;
      lastName?: string;
      email: string;
    };
  }>;
}

export default function CourseDetailPage({ params }: { params: { courseId: string } }) {
  const { hasMinRole } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Check permissions
  if (!hasMinRole(Role.ADMIN)) {
    notFound();
  }

  useEffect(() => {
    fetchCourse();
  }, [params.courseId]);

  const fetchCourse = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/courses/${params.courseId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          notFound();
        }
        throw new Error('Failed to fetch course');
      }
      
      const data = await response.json();
      setCourse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateContent = async (type: string, articleId?: string, sectionId?: string) => {
    try {
      setIsRegenerating(true);
      const response = await fetch(`/api/admin/courses/${params.courseId}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          articleId,
          sectionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate content');
      }

      const result = await response.json();
      alert(result.message);
      
      // Refresh course data
      setTimeout(() => {
        fetchCourse();
      }, 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to regenerate content');
    } finally {
      setIsRegenerating(false);
    }
  };

  const getStatusBadgeColor = (status: CourseStatus) => {
    switch (status) {
      case CourseStatus.PUBLISHED:
        return 'bg-green-100 text-green-800';
      case CourseStatus.DRAFT:
        return 'bg-gray-100 text-gray-800';
      case CourseStatus.GENERATING:
        return 'bg-blue-100 text-blue-800';
      case CourseStatus.ARCHIVED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getLevelBadgeColor = (level: CourseLevel) => {
    switch (level) {
      case CourseLevel.BEGINNER:
        return 'bg-green-100 text-green-800';
      case CourseLevel.INTERMEDIATE:
        return 'bg-yellow-100 text-yellow-800';
      case CourseLevel.ADVANCED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/admin/courses">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Courses
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/admin/courses">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Courses
            </Button>
          </Link>
        </div>
        <Card className="p-6">
          <div className="text-center text-red-600">
            Error loading course: {error || 'Course not found'}
          </div>
        </Card>
      </div>
    );
  }

  const totalArticles = course.sections.reduce((sum, section) => sum + section.articles.length, 0);
  const generatedArticles = course.sections.reduce(
    (sum, section) => sum + section.articles.filter(article => article.isGenerated).length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/courses">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Courses
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
        </div>
        <div className="flex space-x-2">
          <Button onClick={fetchCourse} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href={`/admin/courses/${course.courseId}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Course Header */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <Badge className={getStatusBadgeColor(course.status)}>
                {course.status}
              </Badge>
              <Badge className={getLevelBadgeColor(course.level)}>
                {course.level}
              </Badge>
            </div>
            <p className="text-gray-600 mb-4">{course.description}</p>
            <div className="flex items-center space-x-6 text-sm text-gray-500">
              <div className="flex items-center">
                <BookOpen className="h-4 w-4 mr-1" />
                {generatedArticles}/{totalArticles} articles generated
              </div>
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                {course.enrollments.length} enrolled
              </div>
              <div className="flex items-center">
                <Award className="h-4 w-4 mr-1" />
                {course.certificates.length} certificates
              </div>
              {course.estimatedHours && (
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {course.estimatedHours}h estimated
                </div>
              )}
            </div>
          </div>
        </div>

        {course.generationError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            Generation Error: {course.generationError}
          </div>
        )}

        <div className="flex space-x-2">
          <Button
            onClick={() => regenerateContent('outline')}
            disabled={isRegenerating}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate Outline
          </Button>
        </div>
      </Card>

      {/* Course Sections */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Course Content</h2>
        
        {course.sections.length === 0 ? (
          <Card className="p-6">
            <div className="text-center text-gray-500">
              {course.generationStatus === 'PENDING' || course.generationStatus === 'IN_PROGRESS' ? (
                <div>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
                  <p>Course content is being generated...</p>
                </div>
              ) : (
                <p>No course content available. Click "Regenerate Outline" to generate course structure.</p>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {course.sections.map((section, sectionIndex) => (
              <Card key={section.sectionId} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {sectionIndex + 1}. {section.title}
                    </h3>
                    {section.description && (
                      <p className="text-gray-600 mb-4">{section.description}</p>
                    )}
                  </div>
                  <Button
                    onClick={() => regenerateContent('quiz_generation', undefined, section.sectionId)}
                    disabled={isRegenerating}
                    variant="outline"
                    size="sm"
                  >
                    Generate Section Quiz
                  </Button>
                </div>

                {/* Section Articles */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Articles</h4>
                  {section.articles.map((article, articleIndex) => (
                    <div key={article.articleId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-500 w-6">
                          {articleIndex + 1}.
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {article.title}
                          </p>
                          {article.description && (
                            <p className="text-xs text-gray-600">{article.description}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {article.isGenerated ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                          )}
                          <span className="text-xs text-gray-500">
                            {article.isGenerated ? 'Generated' : 'Not generated'}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        {article.isGenerated && (
                          <Link href={`/articles/${article.articleId}`} target="_blank">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        <Button
                          onClick={() => regenerateContent('article_content', article.articleId)}
                          disabled={isRegenerating}
                          variant="outline"
                          size="sm"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => regenerateContent('quiz_generation', article.articleId)}
                          disabled={isRegenerating}
                          variant="outline"
                          size="sm"
                        >
                          Quiz
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Section Quizzes */}
                {section.quizzes.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Section Quizzes</h4>
                    {section.quizzes.map((quiz) => (
                      <div key={quiz.quizId} className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-900">{quiz.title}</p>
                        <p className="text-xs text-gray-600">
                          {quiz.questions.length} questions • {quiz.attempts.length} attempts
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Final Exam */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Final Exam</h3>
            <p className="text-gray-600">
              Comprehensive exam covering all course sections
            </p>
          </div>
          <Button
            onClick={() => regenerateContent('quiz_generation')}
            disabled={isRegenerating}
            variant="outline"
          >
            Generate Final Exam
          </Button>
        </div>
      </Card>

      {/* Enrollments and Certificates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Enrollments</h3>
          {course.enrollments.length === 0 ? (
            <p className="text-gray-500">No enrollments yet</p>
          ) : (
            <div className="space-y-3">
              {course.enrollments.slice(0, 5).map((enrollment) => (
                <div key={enrollment.enrollmentId} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {enrollment.user.firstName} {enrollment.user.lastName}
                    </p>
                    <p className="text-xs text-gray-600">{enrollment.user.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {new Date(enrollment.enrolledAt).toLocaleDateString()}
                    </p>
                    {enrollment.completedAt && (
                      <p className="text-xs text-green-600">Completed</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Certificates</h3>
          {course.certificates.length === 0 ? (
            <p className="text-gray-500">No certificates issued yet</p>
          ) : (
            <div className="space-y-3">
              {course.certificates.slice(0, 5).map((certificate) => (
                <div key={certificate.certificateId} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {certificate.user.firstName} {certificate.user.lastName}
                    </p>
                    <p className="text-xs text-gray-600">{certificate.user.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {new Date(certificate.issuedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}