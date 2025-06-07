"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Role, CourseLevel, CourseStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, RefreshCw, Users, Award, BookOpen, Clock, CheckCircle, AlertCircle, Eye, Download, Sparkles, History, Trash2, FileQuestion, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  finalExams: Array<{
    quizId: string;
    title: string;
    questions: any[];
    attempts: any[];
  }>;
}

interface CourseExamConfig {
  configId: string;
  courseId: string;
  questionBankSize: number;
  essayQuestionsInBank: number;
  examQuestionCount: number;
  minEssayQuestions: number;
  maxEssayQuestions: number;
  examTimeLimit?: number;
}

export default function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { hasMinRole } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [examConfig, setExamConfig] = useState<CourseExamConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showExamConfig, setShowExamConfig] = useState(false);
  
  // Unwrap the params promise
  const { courseId } = use(params);

  // Check permissions
  if (!hasMinRole(Role.ADMIN)) {
    notFound();
  }

  useEffect(() => {
    fetchCourse();
    fetchExamConfig();
  }, [courseId]);

  const fetchCourse = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/courses/${courseId}`);
      
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

  const fetchExamConfig = async () => {
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/exam-config`);
      if (response.ok) {
        const data = await response.json();
        setExamConfig(data);
      }
    } catch (err) {
      console.error('Failed to fetch exam config:', err);
    }
  };

  const regenerateContent = async (type: string, articleId?: string, sectionId?: string) => {
    try {
      setIsRegenerating(true);
      const response = await fetch(`/api/admin/courses/${courseId}/regenerate`, {
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

  const generateAllContent = async (sectionId?: string) => {
    try {
      setIsRegenerating(true);
      const response = await fetch(`/api/admin/courses/${courseId}/generate-all-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sectionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to queue content generation');
      }

      const result = await response.json();
      alert(`${result.message}\n\nQueued ${result.jobsQueued} article(s) for content generation.`);
      
      // Refresh course data after a delay
      setTimeout(() => {
        fetchCourse();
      }, 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to queue content generation');
    } finally {
      setIsRegenerating(false);
    }
  };

  const generateAllQuizzes = async (regenerateOnly: boolean = false) => {
    try {
      setIsRegenerating(true);
      const response = await fetch(`/api/admin/courses/${courseId}/generate-all-quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          regenerateOnly,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to queue quiz generation');
      }

      const result = await response.json();
      alert(`${result.message}\n\nQueued ${result.jobsQueued} quiz(zes) for ${regenerateOnly ? 'regeneration' : 'generation'}.`);
      
      // Refresh course data after a delay
      setTimeout(() => {
        fetchCourse();
      }, 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to queue quiz generation');
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

  // Count existing quizzes
  const totalQuizzes = course.sections.reduce((sum, section) => {
    const articleQuizzes = section.articles.reduce((articleSum, article) => articleSum + article.quizzes.length, 0);
    const sectionQuizzes = section.quizzes.length;
    return sum + articleQuizzes + sectionQuizzes;
  }, 0) + course.finalExams.length;

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
                <FileQuestion className="h-4 w-4 mr-1" />
                {totalQuizzes} quizzes
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

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => regenerateContent('outline')}
            disabled={isRegenerating}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate Outline
          </Button>
          {totalArticles > 0 && generatedArticles < totalArticles && (
            <Button
              onClick={() => generateAllContent()}
              disabled={isRegenerating}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Generate All Articles ({totalArticles - generatedArticles} remaining)
            </Button>
          )}
          {totalArticles > 0 && generatedArticles > 0 && (
            <>
              <Button
                onClick={() => generateAllQuizzes(false)}
                disabled={isRegenerating}
                variant="outline"
                size="sm"
              >
                <FileQuestion className="h-4 w-4 mr-2" />
                Generate All Quizzes
              </Button>
              <Button
                onClick={() => generateAllQuizzes(true)}
                disabled={isRegenerating}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate Existing Quizzes
              </Button>
            </>
          )}
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
                  <div className="flex space-x-2">
                    {(() => {
                      const ungeneratedCount = section.articles.filter(a => !a.isGenerated).length;
                      return ungeneratedCount > 0 ? (
                        <Button
                          onClick={() => generateAllContent(section.sectionId)}
                          disabled={isRegenerating}
                          variant="outline"
                          size="sm"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Generate {ungeneratedCount} Article{ungeneratedCount > 1 ? 's' : ''}
                        </Button>
                      ) : null;
                    })()}
                    <Button
                      onClick={() => regenerateContent('quiz_generation', undefined, section.sectionId)}
                      disabled={isRegenerating}
                      variant="outline"
                      size="sm"
                    >
                      Generate Section Quiz
                    </Button>
                  </div>
                </div>

                {/* Section Articles */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Articles</h4>
                  {section.articles.map((article, articleIndex) => (
                    <div key={article.articleId} className="flex items-center p-3 bg-gray-50 rounded-lg gap-4">
                      {/* Article number */}
                      <span className="text-sm text-gray-500 w-4 flex-shrink-0">
                        {article.orderIndex + 1}.
                      </span>
                      
                      {/* Article title and description */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {article.title}
                        </p>
                        {article.description && (
                          <p className="text-xs text-gray-600 line-clamp-1">{article.description}</p>
                        )}
                      </div>
                      
                      {/* Status indicator */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {article.isGenerated ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                        )}
                        <span className="text-xs text-gray-500 w-20">
                          {article.isGenerated ? 'Generated' : 'Not generated'}
                        </span>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {article.isGenerated && (
                          <Link href={`/courses/${courseId}/articles/${article.articleId}`}>
                            <Button variant="outline" size="sm" title="View">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        <Link href={`/admin/courses/${courseId}/articles/${article.articleId}/edit`}>
                          <Button variant="outline" size="sm" title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/courses/${courseId}/articles/${article.articleId}/suggest`}>
                          <Button variant="outline" size="sm" title="AI Suggest">
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/courses/${courseId}/articles/${article.articleId}/changes`}>
                          <Button variant="outline" size="sm" title="View History">
                            <History className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          onClick={() => regenerateContent('article_content', article.articleId)}
                          disabled={isRegenerating}
                          variant="outline"
                          size="sm"
                          title="Regenerate"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => regenerateContent('quiz_generation', article.articleId)}
                          disabled={isRegenerating}
                          variant="outline"
                          size="sm"
                          title={article.quizzes.length > 0 ? "Regenerate Quiz" : "Generate Quiz"}
                        >
                          {article.quizzes.length > 0 ? "Re-Quiz" : "Quiz"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Article Quizzes */}
                {section.articles.some(article => article.quizzes.length > 0) && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Article Quizzes</h4>
                    <div className="space-y-2">
                      {section.articles.map(article => 
                        article.quizzes.map((quiz) => (
                          <div key={quiz.quizId} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{quiz.title}</p>
                              <p className="text-xs text-gray-600">
                                {quiz.questions.length} questions • {quiz.attempts.length} attempts
                              </p>
                            </div>
                            <Button
                              onClick={async () => {
                                if (confirm(`Are you sure you want to delete the quiz "${quiz.title}"?\n\nThis will also delete all attempts and student responses.`)) {
                                  try {
                                    const response = await fetch(`/api/admin/courses/quizzes/${quiz.quizId}`, {
                                      method: 'DELETE',
                                    });
                                    if (response.ok) {
                                      alert('Quiz deleted successfully');
                                      fetchCourse();
                                    } else {
                                      const error = await response.json();
                                      alert(`Failed to delete quiz: ${error.error}`);
                                    }
                                  } catch (err) {
                                    alert('Failed to delete quiz');
                                  }
                                }
                              }}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Section Quizzes */}
                {section.quizzes.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Section Quizzes</h4>
                    {section.quizzes.map((quiz) => (
                      <div key={quiz.quizId} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{quiz.title}</p>
                          <p className="text-xs text-gray-600">
                            {quiz.questions.length} questions • {quiz.attempts.length} attempts
                          </p>
                        </div>
                        <Button
                          onClick={async () => {
                            if (confirm(`Are you sure you want to delete the quiz "${quiz.title}"?\n\nThis will also delete all attempts and student responses.`)) {
                              try {
                                const response = await fetch(`/api/admin/courses/quizzes/${quiz.quizId}`, {
                                  method: 'DELETE',
                                });
                                if (response.ok) {
                                  alert('Quiz deleted successfully');
                                  fetchCourse();
                                } else {
                                  const error = await response.json();
                                  alert(`Failed to delete quiz: ${error.error}`);
                                }
                              } catch (err) {
                                alert('Failed to delete quiz');
                              }
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
        <div className="flex items-center justify-between mb-4">
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
            {course.finalExams.length > 0 ? 'Regenerate Final Exam' : 'Generate Final Exam'}
          </Button>
        </div>
        
        {course.finalExams.length > 0 && (
          <div className="space-y-2">
            {course.finalExams.map((quiz) => (
              <div key={quiz.quizId} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{quiz.title}</p>
                  <p className="text-xs text-gray-600">
                    {quiz.questions.length} questions • {quiz.attempts.length} attempts
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    if (confirm(`Are you sure you want to delete the final exam "${quiz.title}"?\n\nThis will also delete all attempts and student responses.`)) {
                      try {
                        const response = await fetch(`/api/admin/courses/quizzes/${quiz.quizId}`, {
                          method: 'DELETE',
                        });
                        if (response.ok) {
                          alert('Final exam deleted successfully');
                          fetchCourse();
                        } else {
                          const error = await response.json();
                          alert(`Failed to delete final exam: ${error.error}`);
                        }
                      } catch (err) {
                        alert('Failed to delete final exam');
                      }
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Exam Configuration */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Exam Configuration</h3>
            <p className="text-gray-600">
              Configure question bank size and exam settings for this course
            </p>
          </div>
          <Button
            onClick={() => setShowExamConfig(!showExamConfig)}
            variant="outline"
          >
            <Settings className="h-4 w-4 mr-2" />
            {showExamConfig ? 'Hide Settings' : 'Show Settings'}
          </Button>
        </div>

        {showExamConfig && examConfig && (
          <ExamConfigForm 
            config={examConfig} 
            onSave={async (newConfig) => {
              try {
                const response = await fetch(`/api/admin/courses/${courseId}/exam-config`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(newConfig),
                });
                if (response.ok) {
                  const updatedConfig = await response.json();
                  setExamConfig(updatedConfig);
                  alert('Exam configuration saved successfully');
                } else {
                  const error = await response.json();
                  alert(`Failed to save configuration: ${error.error}`);
                }
              } catch (err) {
                alert('Failed to save exam configuration');
              }
            }}
          />
        )}

        {!showExamConfig && examConfig && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Question Bank Size</p>
              <p className="font-medium">{examConfig.questionBankSize}</p>
            </div>
            <div>
              <p className="text-gray-600">Essay Questions</p>
              <p className="font-medium">{examConfig.essayQuestionsInBank}</p>
            </div>
            <div>
              <p className="text-gray-600">Exam Questions</p>
              <p className="font-medium">{examConfig.examQuestionCount}</p>
            </div>
            <div>
              <p className="text-gray-600">Time Limit</p>
              <p className="font-medium">{examConfig.examTimeLimit ? `${examConfig.examTimeLimit} min` : 'No limit'}</p>
            </div>
          </div>
        )}
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

function ExamConfigForm({ config, onSave }: { 
  config: CourseExamConfig; 
  onSave: (config: CourseExamConfig) => void; 
}) {
  const [formData, setFormData] = useState(config);

  const updateField = (field: keyof CourseExamConfig, value: number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="questionBankSize">Question Bank Size</Label>
          <Input
            id="questionBankSize"
            type="number"
            min="1"
            max="500"
            value={formData.questionBankSize}
            onChange={(e) => updateField('questionBankSize', parseInt(e.target.value))}
          />
          <p className="text-sm text-gray-600">
            Total number of questions to generate for the question bank
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="essayQuestionsInBank">Essay Questions in Bank</Label>
          <Input
            id="essayQuestionsInBank"
            type="number"
            min="0"
            max={formData.questionBankSize}
            value={formData.essayQuestionsInBank}
            onChange={(e) => updateField('essayQuestionsInBank', parseInt(e.target.value))}
          />
          <p className="text-sm text-gray-600">
            Number of essay questions to include in the bank
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="examQuestionCount">Questions Per Exam</Label>
          <Input
            id="examQuestionCount"
            type="number"
            min="1"
            max={formData.questionBankSize}
            value={formData.examQuestionCount}
            onChange={(e) => updateField('examQuestionCount', parseInt(e.target.value))}
          />
          <p className="text-sm text-gray-600">
            Number of questions to randomly select for each exam
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="examTimeLimit">Time Limit (minutes)</Label>
          <Input
            id="examTimeLimit"
            type="number"
            min="1"
            max="600"
            value={formData.examTimeLimit || ''}
            onChange={(e) => updateField('examTimeLimit', e.target.value ? parseInt(e.target.value) : null)}
          />
          <p className="text-sm text-gray-600">
            Maximum time allowed for the exam (leave empty for no limit)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="minEssayQuestions">Min Essay Questions</Label>
          <Input
            id="minEssayQuestions"
            type="number"
            min="0"
            max={formData.essayQuestionsInBank}
            value={formData.minEssayQuestions}
            onChange={(e) => updateField('minEssayQuestions', parseInt(e.target.value))}
          />
          <p className="text-sm text-gray-600">
            Minimum essay questions to include in each exam
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxEssayQuestions">Max Essay Questions</Label>
          <Input
            id="maxEssayQuestions"
            type="number"
            min={formData.minEssayQuestions}
            max={formData.essayQuestionsInBank}
            value={formData.maxEssayQuestions}
            onChange={(e) => updateField('maxEssayQuestions', parseInt(e.target.value))}
          />
          <p className="text-sm text-gray-600">
            Maximum essay questions to include in each exam
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit">
          Save Configuration
        </Button>
      </div>
    </form>
  );
}