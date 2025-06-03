"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Award, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CourseQuiz from "@/components/course-quiz";

interface FinalExamStatus {
  canTake: boolean;
  reason?: string;
  nextAttemptAt?: string;
  attempts: number;
  bestScore?: number;
  passed: boolean;
  engagementScore?: number;
  courseProgress?: number;
}

interface PageParams {
  params: Promise<{
    courseId: string;
  }>;
}

export default function FinalExamPage({ params }: PageParams) {
  const router = useRouter();
  const { courseId } = use(params);
  const [examStatus, setExamStatus] = useState<FinalExamStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);

  useEffect(() => {
    checkExamStatus();
  }, [courseId]);

  const checkExamStatus = async () => {
    try {
      const response = await fetch(`/api/courses/${courseId}/final-exam/status`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Course not found or you are not enrolled');
          return;
        }
        throw new Error('Failed to check exam status');
      }
      const data = await response.json();
      setExamStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exam status');
    } finally {
      setLoading(false);
    }
  };

  const generateFinalExam = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/courses/${courseId}/final-exam/generate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate final exam');
      }

      // Refresh status after generation
      await checkExamStatus();
      setShowQuiz(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate exam');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (dateString: string) => {
    const targetDate = new Date(dateString);
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();

    if (diff <= 0) return 'Available now';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link href={`/courses/${courseId}`}>
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
          </Link>
        </div>
        <Card className="p-6">
          <div className="text-center text-red-600">{error}</div>
        </Card>
      </div>
    );
  }

  if (showQuiz) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link href={`/courses/${courseId}`}>
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Final Exam</h1>
        </div>

        <CourseQuiz courseId={courseId} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <Link href={`/courses/${courseId}`}>
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Course
          </Button>
        </Link>
        <div className="flex items-center space-x-3 mb-4">
          <Award className="h-8 w-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-gray-900">Final Exam</h1>
        </div>
        <p className="text-gray-600">
          Complete the comprehensive final exam to earn your course certificate.
        </p>
      </div>

      {/* Exam Status Cards */}
      <div className="space-y-6">
        {/* Eligibility Status */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Exam Eligibility</h2>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Course Progress:</span>
                  <Badge className={examStatus?.courseProgress >= 85 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                    {examStatus?.courseProgress || 0}%
                  </Badge>
                </div>
                {examStatus?.engagementScore && (
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600">Engagement Score:</span>
                    <Badge className={examStatus.engagementScore >= 75 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                      {examStatus.engagementScore}%
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <Badge className={examStatus?.canTake ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
              {examStatus?.canTake ? "Eligible" : "Not Eligible"}
            </Badge>
          </div>

          {!examStatus?.canTake && examStatus?.reason && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Requirements Not Met</p>
                <p className="text-yellow-700 text-sm mt-1">{examStatus.reason}</p>
              </div>
            </div>
          )}
        </Card>

        {/* Previous Attempts */}
        {examStatus?.attempts > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Previous Attempts</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{examStatus.attempts}</div>
                <div className="text-sm text-gray-600">Total Attempts</div>
              </div>
              {examStatus.bestScore && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{examStatus.bestScore}%</div>
                  <div className="text-sm text-gray-600">Best Score</div>
                </div>
              )}
              <div className="text-center">
                <Badge className={examStatus.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {examStatus.passed ? "Passed" : "Not Passed"}
                </Badge>
                <div className="text-sm text-gray-600 mt-1">Status</div>
              </div>
            </div>
          </Card>
        )}

        {/* Cooldown Status */}
        {examStatus?.nextAttemptAt && new Date(examStatus.nextAttemptAt) > new Date() && (
          <Card className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Clock className="h-6 w-6 text-orange-600" />
              <h2 className="text-xl font-semibold text-gray-900">Retake Cooldown</h2>
            </div>
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="font-medium text-orange-800">You must wait before retaking the exam</p>
              <p className="text-orange-700 text-sm mt-1">
                Next attempt available in: {formatTimeRemaining(examStatus.nextAttemptAt)}
              </p>
            </div>
          </Card>
        )}

        {/* Take Exam Button */}
        <Card className="p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Ready to Take the Exam?</h2>
            <p className="text-gray-600 mb-6">
              The final exam is comprehensive and covers all course material. 
              Make sure you have sufficient time and a stable internet connection.
            </p>
            
            <Button
              onClick={generateFinalExam}
              disabled={!examStatus?.canTake || loading}
              size="lg"
              className="min-w-48"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Preparing Exam...
                </>
              ) : (
                <>
                  <Award className="h-4 w-4 mr-2" />
                  {examStatus?.attempts > 0 ? 'Retake Final Exam' : 'Start Final Exam'}
                </>
              )}
            </Button>

            {!examStatus?.canTake && (
              <p className="text-sm text-gray-500 mt-4">
                Complete the course requirements to unlock the final exam
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}