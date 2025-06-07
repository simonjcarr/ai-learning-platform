import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Trophy, CheckCircle, XCircle, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";


export const dynamic = 'force-dynamic';
interface QuizResult {
  id: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  submittedAt: Date;
  articleTitle: string;
  articleSlug: string;
}

async function getUserQuizResults(userId: string): Promise<QuizResult[]> {
  try {
    const userResponses = await prisma.userResponse.findMany({
      where: { clerkUserId: userId },
      include: {
        example: {
          include: {
            article: {
              select: {
                articleTitle: true,
                articleSlug: true
              }
            }
          }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    return userResponses.map(response => ({
      id: response.responseId,
      question: response.example.question,
      userAnswer: response.userAnswer,
      correctAnswer: response.example.correctAnswer,
      isCorrect: response.isCorrect,
      submittedAt: response.submittedAt,
      articleTitle: response.example.article.articleTitle,
      articleSlug: response.example.article.articleSlug
    }));
      
  } catch (error) {
    console.error('Error fetching quiz results:', error);
    return [];
  }
}

export default async function UserQuizzesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const quizResults = await getUserQuizResults(userId);
  const totalQuestions = quizResults.length;
  const correctAnswers = quizResults.filter(q => q.isCorrect).length;
  const successRate = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Your Quiz Results</h1>
        <p className="text-gray-600 mt-2">
          Complete history of all quiz questions you&apos;ve answered
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Trophy className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Questions</p>
              <p className="text-2xl font-semibold text-gray-900">{totalQuestions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Correct Answers</p>
              <p className="text-2xl font-semibold text-gray-900">{correctAnswers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white font-bold ${
              successRate >= 70 ? 'bg-green-600' : successRate >= 50 ? 'bg-yellow-600' : 'bg-red-600'
            }`}>
              %
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className={`text-2xl font-semibold ${
                successRate >= 70 ? 'text-green-600' : successRate >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {successRate}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Results */}
      {quizResults.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              All Quiz Results ({totalQuestions} questions)
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {quizResults.map((result) => (
              <div key={result.id} className="p-6">
                <div className="flex items-start space-x-4">
                  {result.isCorrect ? (
                    <CheckCircle className="h-6 w-6 text-green-500 mt-1" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500 mt-1" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          {result.question}
                        </p>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Your answer:</span>
                            <span className={`ml-2 ${result.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                              {result.userAnswer}
                            </span>
                          </div>
                          {!result.isCorrect && (
                            <div>
                              <span className="font-medium text-gray-700">Correct answer:</span>
                              <span className="ml-2 text-green-600">{result.correctAnswer}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-4 text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {result.submittedAt.toLocaleDateString()} at{' '}
                              {result.submittedAt.toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                            <span>•</span>
                            <span>From: {result.articleTitle}</span>
                          </div>
                        </div>
                      </div>
                      <Link
                        href={`/articles/${result.articleSlug}`}
                        className="ml-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View Article
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Trophy className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No quiz results yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Start taking quizzes to see your results here.
          </p>
          <div className="mt-6">
            <Link
              href="/categories"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Take Your First Quiz
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}