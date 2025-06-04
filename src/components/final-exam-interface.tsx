"use client";

import { useState, useEffect } from "react";
import { Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface Question {
  id: string;
  questionNumber: number;
  questionType: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_IN_BLANK' | 'ESSAY';
  questionText: string;
  options?: Record<string, string> | null;
  points: number;
}

interface ExamSession {
  sessionId: string;
  courseId: string;
  courseName: string;
  startedAt: string;
  timeLimit: number; // in minutes
  passMarkPercentage: number;
  totalQuestions: number;
  questions: Question[];
}

interface FinalExamInterfaceProps {
  sessionId: string | undefined;
}

export default function FinalExamInterface({ sessionId }: FinalExamInterfaceProps) {
  const [examSession, setExamSession] = useState<ExamSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchExamSession();
    }
  }, [sessionId]);

  useEffect(() => {
    if (examSession && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleSubmit(); // Auto-submit when time runs out
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [examSession, timeRemaining]);

  const fetchExamSession = async () => {
    try {
      const response = await fetch(`/api/final-exam/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch exam session');
      }
      const data = await response.json();
      setExamSession(data);
      
      // Calculate time remaining
      const startTime = new Date(data.startedAt).getTime();
      const now = new Date().getTime();
      const elapsedMinutes = Math.floor((now - startTime) / (1000 * 60));
      const remainingMinutes = Math.max(0, data.timeLimit - elapsedMinutes);
      setTimeRemaining(remainingMinutes * 60); // Convert to seconds
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exam');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleSubmit = async () => {
    if (!examSession || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/final-exam/sessions/${sessionId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit exam');
      }

      const results = await response.json();
      setResults(results);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit exam');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const renderQuestion = (question: Question) => {
    const answer = answers[question.id] || '';

    switch (question.questionType) {
      case 'MULTIPLE_CHOICE':
        return (
          <div className="space-y-3">
            {question.options && Object.entries(question.options).map(([key, value]) => (
              <label key={key} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value={key}
                  checked={answer === key}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="h-4 w-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                />
                <span className="text-gray-700">{key.toUpperCase()}. {value}</span>
              </label>
            ))}
          </div>
        );

      case 'TRUE_FALSE':
        return (
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                value="true"
                checked={answer === 'true'}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                className="h-4 w-4 text-orange-600 border-gray-300 focus:ring-orange-500"
              />
              <span className="text-gray-700">True</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                value="false"
                checked={answer === 'false'}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                className="h-4 w-4 text-orange-600 border-gray-300 focus:ring-orange-500"
              />
              <span className="text-gray-700">False</span>
            </label>
          </div>
        );

      case 'FILL_IN_BLANK':
        return (
          <input
            type="text"
            value={answer}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Enter your answer..."
          />
        );

      case 'ESSAY':
        return (
          <div className="space-y-2">
            <Textarea
              value={answer}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder="Write your essay response here..."
              className="min-h-48 resize-y"
            />
            <p className="text-sm text-gray-500">
              This question will be graded by AI. Provide a comprehensive, well-structured response.
            </p>
          </div>
        );

      default:
        return <div>Unknown question type</div>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">{error}</div>
      </Card>
    );
  }

  if (submitted && results) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-6">
          <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full ${
            results.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {results.passed ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <span className="font-semibold">
              {results.passed ? 'Exam Passed!' : 'Exam Not Passed'}
            </span>
          </div>

          <div className="space-y-4">
            <div className="text-3xl font-bold text-gray-900">
              {results.score.toFixed(1)}%
            </div>
            <p className="text-gray-600">
              Pass mark: {results.passMarkPercentage}%
            </p>
            <p className="text-sm text-gray-500">
              Total questions: {results.totalQuestions}
              {results.essayQuestions > 0 && ` (${results.essayQuestions} essay questions graded by AI)`}
            </p>
          </div>

          {results.passed && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">
                🏆 Congratulations! Your certificate will be generated shortly.
              </p>
            </div>
          )}

          {!results.passed && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-orange-800">
                You can retake the exam after the cooldown period. Review the course material and try again.
              </p>
            </div>
          )}
        </div>
      </Card>
    );
  }

  if (!examSession) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-600">No exam session found</div>
      </Card>
    );
  }

  const currentQ = examSession.questions[currentQuestion];
  const isLastQuestion = currentQuestion === examSession.questions.length - 1;
  const answeredQuestions = Object.keys(answers).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Timer and Progress */}
      <Card className="p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Badge variant="outline">
              Question {currentQuestion + 1} of {examSession.questions.length}
            </Badge>
            <Badge variant="outline">
              Answered: {answeredQuestions}/{examSession.questions.length}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className={`font-mono ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-700'}`}>
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>
      </Card>

      {/* Question */}
      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <Badge className={`${
                  currentQ.questionType === 'ESSAY' ? 'bg-purple-100 text-purple-800' :
                  currentQ.questionType === 'MULTIPLE_CHOICE' ? 'bg-blue-100 text-blue-800' :
                  currentQ.questionType === 'TRUE_FALSE' ? 'bg-green-100 text-green-800' :
                  'bg-orange-100 text-orange-800'
                }`}>
                  {currentQ.questionType.replace('_', ' ')}
                </Badge>
                <span className="text-sm text-gray-500">{currentQ.points} point(s)</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {currentQ.questionText}
              </h3>
            </div>
          </div>

          {renderQuestion(currentQ)}
        </div>
      </Card>

      {/* Navigation */}
      <Card className="p-4">
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
          >
            Previous
          </Button>

          <div className="flex space-x-2">
            {!isLastQuestion ? (
              <Button
                onClick={() => setCurrentQuestion(prev => prev + 1)}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {submitting ? 'Submitting...' : 'Submit Exam'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Question Grid */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-3">Questions Overview</h4>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {examSession.questions.map((q, index) => (
            <button
              key={q.id}
              onClick={() => setCurrentQuestion(index)}
              className={`w-8 h-8 rounded text-xs font-medium border ${
                index === currentQuestion
                  ? 'bg-orange-600 text-white border-orange-600'
                  : answers[q.id]
                  ? 'bg-green-100 text-green-800 border-green-300'
                  : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}