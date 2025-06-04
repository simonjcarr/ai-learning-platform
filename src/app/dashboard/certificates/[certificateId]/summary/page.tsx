"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Award, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Target, 
  TrendingUp, 
  CheckCircle, 
  BookOpen,
  FileText,
  BarChart3,
  GraduationCap
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourseLevel, CertificateGrade } from "@prisma/client";

interface ArticleProgress {
  articleId: string;
  title: string;
  description: string;
  orderIndex: number;
  contentSummary: string;
  isCompleted: boolean;
  completedAt: string | null;
  engagementScore: number | null;
  timeSpent: number | null;
  bestQuizScore: number | null;
  quizPassed: boolean | null;
}

interface SectionProgress {
  sectionId: string;
  title: string;
  description: string;
  orderIndex: number;
  articles: ArticleProgress[];
  bestQuizScore: number | null;
  quizPassed: boolean | null;
  totalArticles: number;
  completedArticles: number;
}

interface CertificateSummary {
  certificate: {
    certificateId: string;
    issuedAt: string;
    grade: CertificateGrade;
    finalScore: number;
    engagementScore: number;
    certificateData: any;
  };
  course: {
    courseId: string;
    title: string;
    slug: string;
    description: string;
    level: CourseLevel;
    estimatedHours: number;
    passMarkPercentage: number;
  };
  user: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  sections: SectionProgress[];
  courseMetrics: {
    totalSections: number;
    totalArticles: number;
    completedArticles: number;
    totalTimeSpent: number;
    averageEngagement: number;
  };
}

export default function CertificateSummaryPage({ params }: { params: Promise<{ certificateId: string }> }) {
  const router = useRouter();
  const { certificateId } = use(params);
  const [summary, setSummary] = useState<CertificateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCertificateSummary();
  }, [certificateId]);

  const fetchCertificateSummary = async () => {
    try {
      const response = await fetch(`/api/certificates/${certificateId}/summary`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Certificate not found');
          return;
        }
        throw new Error('Failed to fetch certificate summary');
      }
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load certificate summary');
    } finally {
      setLoading(false);
    }
  };

  const getGradeBadgeColor = (grade: CertificateGrade) => {
    switch (grade) {
      case CertificateGrade.GOLD:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case CertificateGrade.SILVER:
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case CertificateGrade.BRONZE:
        return 'bg-orange-100 text-orange-800 border-orange-300';
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

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href={`/dashboard/certificates/${certificateId}`}>
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Certificate
          </Button>
        </Link>
        <Card className="p-6">
          <div className="text-center text-red-600">
            {error || 'Certificate summary not found'}
          </div>
        </Card>
      </div>
    );
  }

  const studentName = summary.user.firstName && summary.user.lastName 
    ? `${summary.user.firstName} ${summary.user.lastName}`
    : summary.user.email;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-6">
        <Link href={`/dashboard/certificates/${certificateId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Certificate
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Learning Summary</h1>
            <p className="text-gray-600">Detailed overview of course completion and achievements</p>
          </div>
          <Award className={`h-12 w-12 ${
            summary.certificate.grade === CertificateGrade.GOLD ? 'text-yellow-600' :
            summary.certificate.grade === CertificateGrade.SILVER ? 'text-gray-600' :
            'text-orange-600'
          }`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Student</p>
                <p className="text-lg font-semibold text-gray-900">{studentName}</p>
              </div>
              <GraduationCap className="h-8 w-8 text-gray-400" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Course</p>
                <p className="text-lg font-semibold text-gray-900">{summary.course.title}</p>
                <Badge className={getLevelBadgeColor(summary.course.level)} size="sm">
                  {summary.course.level}
                </Badge>
              </div>
              <BookOpen className="h-8 w-8 text-gray-400" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Grade Achieved</p>
                <Badge className={`${getGradeBadgeColor(summary.certificate.grade)} text-base px-3 py-1`}>
                  {summary.certificate.grade}
                </Badge>
              </div>
              <Target className="h-8 w-8 text-gray-400" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completion Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(summary.certificate.issuedAt).toLocaleDateString()}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
          </Card>
        </div>
      </div>

      {/* Course Overview */}
      <Card className="mb-8 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Course Overview</h2>
        <p className="text-gray-700 mb-4">{summary.course.description}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{summary.courseMetrics.totalSections}</div>
            <div className="text-sm text-gray-600">Sections</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {summary.courseMetrics.completedArticles}/{summary.courseMetrics.totalArticles}
            </div>
            <div className="text-sm text-gray-600">Articles Completed</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {formatTime(summary.courseMetrics.totalTimeSpent)}
            </div>
            <div className="text-sm text-gray-600">Time Invested</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {summary.courseMetrics.averageEngagement.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Avg Engagement</div>
          </div>
        </div>
      </Card>

      {/* Section Details */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Learning Modules</h2>
        
        {summary.sections.map((section, sectionIndex) => (
          <Card key={section.sectionId} className="p-6">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {sectionIndex + 1}. {section.title}
                </h3>
                <div className="flex items-center space-x-2">
                  {section.bestQuizScore !== null && (
                    <Badge variant={section.quizPassed ? "default" : "destructive"}>
                      Quiz: {section.bestQuizScore.toFixed(1)}%
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {section.completedArticles}/{section.totalArticles} Complete
                  </Badge>
                </div>
              </div>
              {section.description && (
                <p className="text-gray-600 mb-4">{section.description}</p>
              )}
            </div>

            <div className="space-y-3">
              {section.articles.map((article, articleIndex) => (
                <div key={article.articleId} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1">
                        {sectionIndex + 1}.{articleIndex + 1} {article.title}
                      </h4>
                      {article.description && (
                        <p className="text-sm text-gray-600 mb-2">{article.description}</p>
                      )}
                      {article.contentSummary && (
                        <p className="text-sm text-gray-700 italic">{article.contentSummary}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {article.isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      {article.timeSpent && (
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatTime(article.timeSpent)}
                        </div>
                      )}
                      {article.engagementScore && (
                        <div className="flex items-center">
                          <TrendingUp className="h-4 w-4 mr-1" />
                          {article.engagementScore.toFixed(1)}% engagement
                        </div>
                      )}
                    </div>
                    {article.bestQuizScore !== null && (
                      <Badge 
                        variant={article.quizPassed ? "default" : "destructive"}
                        size="sm"
                      >
                        Quiz: {article.bestQuizScore.toFixed(1)}%
                      </Badge>
                    )}
                  </div>

                  {article.completedAt && (
                    <div className="text-xs text-gray-400 mt-2">
                      Completed: {new Date(article.completedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Footer */}
      <Card className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Congratulations on Your Achievement!
          </h3>
          <p className="text-gray-600 mb-4">
            This summary represents your comprehensive learning journey through {summary.course.title}. 
            Your {summary.certificate.grade.toLowerCase()} grade certificate demonstrates your commitment 
            to continuous learning and professional development.
          </p>
          <div className="flex justify-center space-x-4">
            <Link href={`/dashboard/certificates/${certificateId}`}>
              <Button variant="outline">
                <Award className="h-4 w-4 mr-2" />
                View Certificate
              </Button>
            </Link>
            <Link href={`/courses/${summary.course.slug}`}>
              <Button>
                <BookOpen className="h-4 w-4 mr-2" />
                Review Course
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}