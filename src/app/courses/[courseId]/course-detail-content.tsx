"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { CourseLevel } from "@prisma/client";
import Link from "next/link";
import { 
  BookOpen, 
  Clock, 
  Users, 
  Award, 
  Play,
  CheckCircle,
  Lock,
  ArrowLeft,
  User,
  Calendar,
  TrendingUp,
  Target,
  LogIn,
  CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourseLikeButton } from "@/components/course-like-button";

interface CourseArticle {
  articleId: string;
  title: string;
  description?: string;
  orderIndex: number;
  isGenerated: boolean;
  generatedAt?: string;
}

interface CourseQuiz {
  quizId: string;
  title: string;
  description?: string;
  _count: {
    questions: number;
  };
}

interface CourseSection {
  sectionId: string;
  title: string;
  description?: string;
  orderIndex: number;
  articles: CourseArticle[];
  quizzes: CourseQuiz[];
}

interface CourseProgress {
  progressId: string;
  articleId: string;
  isCompleted: boolean;
  completedAt?: string;
  timeSpent: number;
}

interface QuizAttemptData {
  [key: string]: { score: number; passed: boolean; completedAt: string }[];
  sections?: Record<string, { score: number; passed: boolean; completedAt: string }[]>;
}

interface Course {
  courseId: string;
  title: string;
  slug: string;
  description: string;
  level: CourseLevel;
  estimatedHours?: number;
  passMarkPercentage: number;
  createdAt: string;
  publishedAt?: string;
  createdBy: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  sections: CourseSection[];
  totalSections: number;
  totalArticles: number;
  generatedArticles: number;
  enrollmentCount: number;
  certificateCount: number;
  isEnrolled: boolean;
  enrolledAt?: string;
  isCompleted: boolean;
  completedAt?: string;
  progressPercentage: number;
  completedArticles: number;
  progress: CourseProgress[];
  quizAttempts: QuizAttemptData;
}

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default function CourseDetailContent({ params }: PageProps) {
  const { user, isSignedIn } = useAuth();
  const { access: courseAccess, loading: accessLoading } = useFeatureAccess("access_courses");
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [certificate, setCertificate] = useState<any>(null);

  // Unwrap the params promise
  const { courseId } = use(params);

  useEffect(() => {
    fetchCourse();
    if (user) {
      checkCertificate();
    }
  }, [courseId, user]);

  const fetchCourse = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/courses/${courseId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Course not found');
          return;
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

  const checkCertificate = async () => {
    try {
      const response = await fetch('/api/certificates');
      if (response.ok) {
        const certificates = await response.json();
        const courseCert = certificates.find((cert: any) => cert.courseId === courseId);
        if (courseCert) {
          setCertificate(courseCert);
        }
      }
    } catch (err) {
      console.error('Failed to check certificate:', err);
    }
  };

  const handleEnroll = async () => {
    try {
      setIsEnrolling(true);
      const response = await fetch(`/api/courses/${courseId}/enroll`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to enroll');
      }

      // Refresh course data
      await fetchCourse();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to enroll in course');
    } finally {
      setIsEnrolling(false);
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

  const isArticleCompleted = (articleId: string) => {
    if (!course?.progress) return false;
    const progress = course.progress.find(p => p.articleId === articleId);
    return progress?.isCompleted || false;
  };

  const getArticleQuizScore = (articleId: string) => {
    if (!course?.quizAttempts || !course.quizAttempts[articleId]) return null;
    
    const attempts = course.quizAttempts[articleId];
    // Return the best score (attempts are already sorted by score, highest first)
    return attempts.length > 0 ? attempts[0].score : null;
  };

  const hasPassedArticleQuiz = (articleId: string) => {
    if (!course?.quizAttempts || !course.quizAttempts[articleId]) return false;
    
    const attempts = course.quizAttempts[articleId];
    return attempts.some(attempt => attempt.passed);
  };

  const getSectionQuizScore = (sectionId: string) => {
    if (!course?.quizAttempts?.sections || !course.quizAttempts.sections[sectionId]) return null;
    
    const attempts = course.quizAttempts.sections[sectionId];
    // Return the best score (attempts are already sorted by score, highest first)
    return attempts.length > 0 ? attempts[0] : null;
  };

  const hasPassedSectionQuiz = (sectionId: string) => {
    if (!course?.quizAttempts?.sections || !course.quizAttempts.sections[sectionId]) return false;
    
    const attempts = course.quizAttempts.sections[sectionId];
    return attempts.some(attempt => attempt.passed);
  };

  const getNextIncompleteArticle = () => {
    if (!course?.isEnrolled) return null;
    
    for (const section of course.sections) {
      for (const article of section.articles) {
        if (!isArticleCompleted(article.articleId)) {
          return { section, article };
        }
      }
    }
    return null;
  };

  const nextArticle = getNextIncompleteArticle();

  // Determine user access status
  const hasCoursesAccess = !accessLoading && courseAccess?.hasAccess;
  const canAccessCourse = isSignedIn && hasCoursesAccess;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <Link href="/courses">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Courses
            </Button>
          </Link>
        </div>
        <Card className="p-12">
          <div className="text-center">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {error === 'Course not found' ? 'Course No Longer Available' : 'Course Not Found'}
            </h3>
            <p className="text-gray-600 mb-6">
              {error === 'Course not found' 
                ? 'This course may have been removed or is no longer accessible. Don\'t worry - if you had a certificate for this course, it\'s still valid and available in your dashboard.'
                : 'We couldn\'t find the course you\'re looking for. It may have been moved or removed.'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/courses">
                <Button>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Browse All Courses
                </Button>
              </Link>
              {isSignedIn && (
                <Link href="/dashboard/certificates">
                  <Button variant="outline">
                    <Award className="h-4 w-4 mr-2" />
                    View My Certificates
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-6">
        <Link href="/courses">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
        </Link>
      </div>

      {/* Course Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
            <div className="flex items-center space-x-2 mb-4">
              <Badge className={getLevelBadgeColor(course.level)}>
                {course.level}
              </Badge>
              {course.isEnrolled && course.isCompleted && (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              )}
              {certificate && (
                <Badge className={
                  certificate.grade === 'GOLD' ? 'bg-yellow-100 text-yellow-800' :
                  certificate.grade === 'SILVER' ? 'bg-gray-100 text-gray-800' :
                  'bg-orange-100 text-orange-800'
                }>
                  <Award className="h-3 w-3 mr-1" />
                  {certificate.grade} Certificate
                </Badge>
              )}
              {course.isEnrolled && !course.isCompleted && (
                <Badge className="bg-blue-100 text-blue-800">
                  In Progress ({course.progressPercentage}%)
                </Badge>
              )}
            </div>
            <p className="text-lg text-gray-600 mb-6">{course.description}</p>
          </div>
        </div>

        {/* Course Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <BookOpen className="h-4 w-4" />
            <span>{course.totalSections} sections</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Target className="h-4 w-4" />
            <span>{course.totalArticles} articles</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            <span>{course.enrollmentCount} enrolled</span>
          </div>
          {course.estimatedHours && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>{course.estimatedHours}h estimated</span>
            </div>
          )}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Award className="h-4 w-4" />
            <span>{course.passMarkPercentage}% to pass</span>
          </div>
        </div>

        {/* Instructor Info */}
        <div className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
          <User className="h-4 w-4" />
          <span>Created by {course.createdBy.firstName} {course.createdBy.lastName}</span>
          <Calendar className="h-4 w-4 ml-4" />
          <span>Published {course.publishedAt ? new Date(course.publishedAt).toLocaleDateString() : 'Recently'}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-4">
          <div className="flex space-x-4">
            {!canAccessCourse ? (
              <div className="flex space-x-3">
                {!isSignedIn ? (
                  <>
                    <Link href="/sign-in">
                      <Button size="lg">
                        <LogIn className="h-4 w-4 mr-2" />
                        Sign In to Enroll
                      </Button>
                    </Link>
                    <Link href="/sign-up">
                      <Button variant="outline" size="lg">
                        Sign Up
                      </Button>
                    </Link>
                  </>
                ) : (
                  <Link href="/pricing">
                    <Button size="lg">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Upgrade to Access Courses
                    </Button>
                  </Link>
                )}
              </div>
            ) : !course.isEnrolled ? (
              <Button 
                onClick={handleEnroll} 
                disabled={isEnrolling}
                size="lg"
              >
                {isEnrolling ? 'Enrolling...' : 'Enroll in Course'}
              </Button>
            ) : nextArticle ? (
              <Link href={`/courses/${courseId}/articles/${nextArticle.article.articleId}`}>
                <Button size="lg">
                  <Play className="h-4 w-4 mr-2" />
                  {course.progressPercentage === 0 ? 'Start Course' : 'Continue Learning'}
                </Button>
              </Link>
            ) : (
              <Button size="lg" disabled>
                <CheckCircle className="h-4 w-4 mr-2" />
                Course Completed
              </Button>
            )}
          </div>
          
          {/* Like Button - only show if user is signed in */}
          {isSignedIn && (
            <CourseLikeButton 
              courseId={courseId}
              size="lg"
              variant="outline"
            />
          )}
        </div>
      </div>

      {/* Certificate Card (if earned) */}
      {certificate && (
        <Card className={`p-6 mb-8 ${
          certificate.grade === 'GOLD' ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300' :
          certificate.grade === 'SILVER' ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300' :
          'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Award className={`h-12 w-12 ${
                certificate.grade === 'GOLD' ? 'text-yellow-600' :
                certificate.grade === 'SILVER' ? 'text-gray-600' :
                'text-orange-600'
              }`} />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Course Certificate Earned!
                </h3>
                <p className="text-gray-600">
                  You achieved a {certificate.grade} grade with a final score of {certificate.finalScore?.toFixed(1)}%
                </p>
              </div>
            </div>
            <Link href={`/dashboard/certificates/${certificate.certificateId}`}>
              <Button>
                View Certificate
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Progress Bar (if enrolled) */}
      {course.isEnrolled && (
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Your Progress</h3>
            <span className="text-sm text-gray-600">
              {course.completedArticles} of {course.totalArticles} articles completed
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${course.progressPercentage}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {course.progressPercentage}% complete
            {course.isCompleted && course.completedAt && (
              <span className="ml-2 text-green-600">
                • Completed on {new Date(course.completedAt).toLocaleDateString()}
              </span>
            )}
          </p>
        </Card>
      )}

      {/* Course Content */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Course Content</h2>
        
        {course.sections.map((section, sectionIndex) => (
          <Card key={section.sectionId} className="p-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {sectionIndex + 1}. {section.title}
              </h3>
              {section.description && (
                <p className="text-gray-600">{section.description}</p>
              )}
            </div>

            {/* Articles in Section */}
            <div className="space-y-3">
              {section.articles.map((article, articleIndex) => {
                const isCompleted = isArticleCompleted(article.articleId);
                const isAccessible = canAccessCourse && course.isEnrolled && article.isGenerated;
                const quizScore = getArticleQuizScore(article.articleId);
                const hasPassedQuiz = hasPassedArticleQuiz(article.articleId);
                
                return (
                  <div 
                    key={article.articleId} 
                    className={`rounded-lg border p-4 ${
                      isCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* Mobile and Desktop Layout */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                      {/* Article Header with Icon and Number */}
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          {isCompleted ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : isAccessible ? (
                            <Play className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Lock className="h-5 w-5 text-gray-400" />
                          )}
                          <span className="text-sm text-gray-500 font-medium">
                            {articleIndex + 1}.
                          </span>
                        </div>
                        
                        {/* Article Content */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 text-base mb-1">{article.title}</h4>
                          {article.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{article.description}</p>
                          )}
                          
                          {/* Status and Quiz Info */}
                          <div className="flex flex-col space-y-2">
                            {!article.isGenerated && (
                              <p className="text-xs text-yellow-600 font-medium">Content being generated...</p>
                            )}
                            
                            <div className="flex flex-wrap items-center gap-2">
                              {quizScore !== null && (
                                <Badge className={`text-xs ${
                                  hasPassedQuiz 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  Quiz: {quizScore.toFixed(1)}% {hasPassedQuiz ? '(Passed)' : '(Retry needed)'}
                                </Badge>
                              )}
                              
                              {isCompleted && (
                                <div className="flex items-center space-x-1 sm:hidden">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span className="text-sm font-medium text-green-600">Completed</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Area */}
                      <div className="flex items-center justify-between sm:justify-end sm:space-x-3 mt-3 sm:mt-0">
                        {/* Completion Status (Desktop only) */}
                        {isCompleted && (
                          <div className="text-right hidden sm:block">
                            <div className="flex items-center space-x-1">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium text-green-600">Completed</span>
                            </div>
                            {quizScore !== null && (
                              <p className="text-xs text-gray-500 mt-1">Quiz: {quizScore.toFixed(1)}%</p>
                            )}
                          </div>
                        )}
                        
                        {/* Action Button */}
                        <div className="flex-shrink-0">
                          {isAccessible ? (
                            <Link href={`/courses/${courseId}/articles/${article.articleId}`}>
                              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                                {isCompleted ? 'Review' : 'Start'}
                              </Button>
                            </Link>
                          ) : (
                            <Button variant="outline" size="sm" disabled className="w-full sm:w-auto">
                              {canAccessCourse 
                                ? (course.isEnrolled ? 'Generating...' : 'Enroll to Access')
                                : (!isSignedIn ? 'Sign In to Access' : 'Upgrade to Access')
                              }
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Section Quizzes */}
            {section.quizzes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Section Quizzes</h4>
                {section.quizzes.map((quiz) => {
                  const sectionQuizScore = getSectionQuizScore(section.sectionId);
                  const hasPassedQuiz = hasPassedSectionQuiz(section.sectionId);
                  
                  return (
                    <div key={quiz.quizId} className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 mb-1">{quiz.title}</h5>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-2">
                            <span>{quiz._count.questions} questions</span>
                            {course.passMarkPercentage && (
                              <span>• Pass mark: {course.passMarkPercentage}%</span>
                            )}
                          </div>
                          {sectionQuizScore && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`text-xs ${
                                hasPassedQuiz 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                <Award className="h-3 w-3 mr-1" />
                                Best Score: {sectionQuizScore.score.toFixed(1)}%
                              </Badge>
                              {hasPassedQuiz && (
                                <span className="text-xs text-green-600 font-medium">✓ Passed</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {canAccessCourse && course.isEnrolled ? (
                            <Link href={`/courses/${courseId}/sections/${section.sectionId}/quizzes`}>
                              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                                {sectionQuizScore ? 'Retake Quiz' : 'Take Quiz'}
                              </Button>
                            </Link>
                          ) : (
                            <Button variant="outline" size="sm" disabled className="w-full sm:w-auto">
                              Take Quiz
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Final Exam */}
      <Card className="p-6 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Final Exam</h3>
            <p className="text-gray-600">
              Complete all course content and pass the final exam with {course.passMarkPercentage}% or higher to earn your certificate.
            </p>
          </div>
          {canAccessCourse && course.isEnrolled ? (
            <Link href={`/courses/${courseId}/final-exam`}>
              <Button 
                variant="outline" 
                disabled={course.progressPercentage < 85}
              >
                <Award className="h-4 w-4 mr-2" />
                {course.progressPercentage < 85 ? 'Complete Course First' : 'Take Final Exam'}
              </Button>
            </Link>
          ) : (
            <Button 
              variant="outline" 
              disabled
            >
              <Award className="h-4 w-4 mr-2" />
              Take Final Exam
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}