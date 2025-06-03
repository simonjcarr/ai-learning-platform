"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle, XCircle, Clock, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface QuizOption {
  key: string;
  text: string;
}

interface QuizQuestion {
  questionId: string;
  questionType: string;
  questionText: string;
  optionsJson: QuizOption[] | null;
  correctAnswer: string;
  explanation: string | null;
  orderIndex: number;
  points: number;
}

interface Quiz {
  quizId: string;
  title: string;
  description: string | null;
  quizType: string;
  passMarkPercentage: number;
  timeLimit: number | null;
  maxAttempts: number | null;
  questions: QuizQuestion[];
}

interface QuizAttempt {
  attemptId: string;
  score: number;
  passed: boolean;
  completedAt: string;
}

interface CourseQuizProps {
  articleId?: string;
  sectionId?: string;
  courseId?: string;
}

export default function CourseQuiz({ articleId, sectionId, courseId }: CourseQuizProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    score: number;
    passed: boolean;
    feedback: Record<string, { isCorrect: boolean; explanation: string | null }>;
  } | null>(null);
  const [previousAttempts, setPreviousAttempts] = useState<Record<string, QuizAttempt[]>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    if (articleId || sectionId || courseId) {
      fetchQuizzes();
    }
  }, [articleId, sectionId, courseId]);

  useEffect(() => {
    if (timerActive && timeRemaining !== null && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timerActive && timeRemaining === 0) {
      // Auto-submit when time runs out
      handleSubmitQuiz();
    }
  }, [timerActive, timeRemaining]);

  const fetchQuizzes = async () => {
    try {
      const endpoint = articleId 
        ? `/api/courses/articles/${articleId}/quizzes`
        : sectionId
        ? `/api/courses/sections/${sectionId}/quizzes`
        : `/api/courses/${courseId}/quizzes`;
      
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Failed to fetch quizzes");
      const data = await response.json();
      setQuizzes(data.quizzes || []);
      setPreviousAttempts(data.attempts || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setAnswers({});
    setQuizResult(null);
    if (quiz.timeLimit) {
      setTimeRemaining(quiz.timeLimit * 60); // Convert minutes to seconds
      setTimerActive(true);
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleSubmitQuiz = async () => {
    if (!selectedQuiz) return;

    setSubmitting(true);
    setTimerActive(false);

    try {
      const response = await fetch(`/api/courses/quizzes/${selectedQuiz.quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) throw new Error("Failed to submit quiz");

      const result = await response.json();
      setQuizResult(result);
      
      // Refresh to get updated attempts
      const endpoint = articleId 
        ? `/api/courses/articles/${articleId}/quizzes`
        : sectionId
        ? `/api/courses/sections/${sectionId}/quizzes`
        : `/api/courses/${courseId}/quizzes`;
        
      const updatedAttempts = await fetch(endpoint);
      if (updatedAttempts.ok) {
        const data = await updatedAttempts.json();
        setPreviousAttempts(data.attempts || {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderQuestion = (question: QuizQuestion) => {
    const userAnswer = answers[question.questionId];
    const result = quizResult?.feedback[question.questionId];
    
    // Ensure optionsJson is an array
    const options = Array.isArray(question.optionsJson) 
      ? question.optionsJson 
      : question.optionsJson 
        ? Object.values(question.optionsJson as any)
        : [];

    return (
      <div key={question.questionId} className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="mb-3">
          <div className="flex items-start justify-between">
            <h4 className="font-medium text-gray-900">
              {question.orderIndex + 1}. {question.questionText}
            </h4>
            <span className="text-sm text-gray-500">
              {question.points} point{question.points !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {question.questionType === "MULTIPLE_CHOICE" && options.length > 0 && (
          <div className="space-y-2">
            {options.map((option) => (
              <label
                key={option.key}
                className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  result
                    ? result.isCorrect && userAnswer === option.key
                      ? "bg-green-50 border-green-300"
                      : !result.isCorrect && userAnswer === option.key
                      ? "bg-red-50 border-red-300"
                      : question.correctAnswer === option.key
                      ? "bg-green-50 border-green-300"
                      : "bg-white border-gray-200"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name={`question-${question.questionId}`}
                  value={option.key}
                  onChange={(e) => handleAnswerChange(question.questionId, e.target.value)}
                  disabled={!!quizResult}
                  checked={userAnswer === option.key}
                  className="h-4 w-4 text-blue-600"
                />
                <span className="text-gray-700">{option.text}</span>
                {result && (
                  <>
                    {result.isCorrect && userAnswer === option.key && (
                      <CheckCircle className="h-5 w-5 text-green-600 ml-auto" />
                    )}
                    {!result.isCorrect && userAnswer === option.key && (
                      <XCircle className="h-5 w-5 text-red-600 ml-auto" />
                    )}
                    {!result.isCorrect && question.correctAnswer === option.key && (
                      <CheckCircle className="h-5 w-5 text-green-600 ml-auto" />
                    )}
                  </>
                )}
              </label>
            ))}
          </div>
        )}

        {question.questionType === "TRUE_FALSE" && (
          <div className="space-y-2">
            {[
              { key: "true", text: "True" },
              { key: "false", text: "False" }
            ].map((option) => (
              <label
                key={option.key}
                className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  result
                    ? result.isCorrect && userAnswer === option.key
                      ? "bg-green-50 border-green-300"
                      : !result.isCorrect && userAnswer === option.key
                      ? "bg-red-50 border-red-300"
                      : question.correctAnswer === option.key
                      ? "bg-green-50 border-green-300"
                      : "bg-white border-gray-200"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name={`question-${question.questionId}`}
                  value={option.key}
                  onChange={(e) => handleAnswerChange(question.questionId, e.target.value)}
                  disabled={!!quizResult}
                  checked={userAnswer === option.key}
                  className="h-4 w-4 text-blue-600"
                />
                <span className="text-gray-700">{option.text}</span>
              </label>
            ))}
          </div>
        )}

        {(question.questionType === "FILL_IN_BLANK" || question.questionType === "ESSAY") && (
          <textarea
            value={userAnswer || ""}
            onChange={(e) => handleAnswerChange(question.questionId, e.target.value)}
            disabled={!!quizResult}
            placeholder={question.questionType === "ESSAY" ? "Enter your essay answer..." : "Enter your answer..."}
            rows={question.questionType === "ESSAY" ? 6 : 2}
            className={`w-full px-3 py-2 border rounded-md ${
              result
                ? result.isCorrect
                  ? "bg-green-50 border-green-300"
                  : "bg-red-50 border-red-300"
                : "border-gray-300"
            }`}
          />
        )}

        {result && question.explanation && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Explanation:</strong> {question.explanation}
            </p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  if (quizzes.length === 0) {
    return null;
  }

  const quizTitle = articleId ? "Article Quizzes" : sectionId ? "Section Quizzes" : "Final Exam";
  
  return (
    <section className="border-t pt-12 mt-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{quizTitle}</h2>

      {!selectedQuiz ? (
        <div className="space-y-4">
          {quizzes.map((quiz) => {
            const attempts = previousAttempts[quiz.quizId] || [];
            const canAttempt = !quiz.maxAttempts || attempts.length < quiz.maxAttempts;
            const bestScore = attempts.length > 0
              ? Math.max(...attempts.map(a => a.score))
              : null;

            return (
              <Card key={quiz.quizId} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{quiz.title}</h3>
                    {quiz.description && (
                      <p className="text-gray-600 mt-1">{quiz.description}</p>
                    )}
                  </div>
                  {bestScore !== null && (
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        <span className="font-medium">{bestScore.toFixed(1)}%</span>
                      </div>
                      <span className="text-sm text-gray-500">Best Score</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <span>{quiz.questions.length} questions</span>
                  <span>•</span>
                  <span>Pass mark: {quiz.passMarkPercentage}%</span>
                  {quiz.timeLimit && (
                    <>
                      <span>•</span>
                      <span className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {quiz.timeLimit} minutes
                      </span>
                    </>
                  )}
                  {quiz.maxAttempts && (
                    <>
                      <span>•</span>
                      <span>{attempts.length}/{quiz.maxAttempts} attempts</span>
                    </>
                  )}
                </div>

                <Button
                  onClick={() => startQuiz(quiz)}
                  disabled={!canAttempt}
                  variant={canAttempt ? "default" : "secondary"}
                >
                  {canAttempt
                    ? attempts.length > 0
                      ? "Retake Quiz"
                      : "Start Quiz"
                    : "No Attempts Remaining"}
                </Button>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">{selectedQuiz.title}</h3>
              {timeRemaining !== null && (
                <div className={`flex items-center space-x-2 ${
                  timeRemaining < 60 ? "text-red-600" : "text-gray-600"
                }`}>
                  <Clock className="h-5 w-5" />
                  <span className="font-mono font-medium">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              )}
            </div>
            {selectedQuiz.description && (
              <p className="text-gray-600 mt-2">{selectedQuiz.description}</p>
            )}
          </div>

          <div className="space-y-6">
            {selectedQuiz.questions
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map(renderQuestion)}
          </div>

          {!quizResult ? (
            <div className="mt-6 flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedQuiz(null);
                  setTimerActive(false);
                  setTimeRemaining(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitQuiz}
                disabled={submitting || Object.keys(answers).length === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Quiz"
                )}
              </Button>
            </div>
          ) : (
            <div className="mt-6">
              <Card className={`p-6 ${
                quizResult.passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold">
                      {quizResult.passed ? "Congratulations!" : "Keep Trying!"}
                    </h4>
                    <p className="text-gray-700 mt-1">
                      Your score: {quizResult.score.toFixed(1)}%
                      {quizResult.passed
                        ? " - You passed!"
                        : ` - You need ${selectedQuiz.passMarkPercentage}% to pass`}
                    </p>
                  </div>
                  {quizResult.passed ? (
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  ) : (
                    <XCircle className="h-12 w-12 text-red-600" />
                  )}
                </div>
              </Card>
              <Button
                className="mt-4"
                onClick={() => setSelectedQuiz(null)}
              >
                Back to Quizzes
              </Button>
            </div>
          )}
        </Card>
      )}
    </section>
  );
}