import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BookOpen, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

interface ArticleData {
  id: string;
  title: string;
  slug: string;
  lastAccessed: Date;
  quizzesTaken: number;
  correctAnswers: number;
  totalQuestions: number;
  hasQuizResponses: boolean;
}

async function getUserArticles(userId: string): Promise<ArticleData[]> {
  try {
    // Get all viewed articles
    const [viewedArticles, userResponses] = await Promise.all([
      // Get all articles the user has viewed
      prisma.userArticleView.findMany({
        where: { clerkUserId: userId },
        include: {
          article: {
            select: {
              articleId: true,
              articleTitle: true,
              articleSlug: true
            }
          }
        },
        orderBy: { viewedAt: 'desc' }
      }),
      // Get all user responses for quiz stats
      prisma.userResponse.findMany({
        where: { clerkUserId: userId },
        include: {
          example: {
            select: {
              articleId: true
            }
          }
        }
      })
    ]);

    // Group responses by article for stats
    const responseMap = new Map<string, { correctAnswers: number; totalQuestions: number }>();
    
    userResponses.forEach(response => {
      const articleId = response.example.articleId;
      
      if (!responseMap.has(articleId)) {
        responseMap.set(articleId, {
          correctAnswers: 0,
          totalQuestions: 0
        });
      }
      
      const stats = responseMap.get(articleId)!;
      stats.totalQuestions++;
      if (response.isCorrect) {
        stats.correctAnswers++;
      }
    });

    // Create article data combining views and quiz stats
    const articles = viewedArticles.map(view => {
      const quizStats = responseMap.get(view.article.articleId) || {
        correctAnswers: 0,
        totalQuestions: 0
      };
      
      return {
        id: view.article.articleId,
        title: view.article.articleTitle,
        slug: view.article.articleSlug,
        lastAccessed: view.viewedAt,
        quizzesTaken: quizStats.totalQuestions,
        correctAnswers: quizStats.correctAnswers,
        totalQuestions: quizStats.totalQuestions,
        hasQuizResponses: quizStats.totalQuestions > 0
      };
    });

    return articles;
      
  } catch (error) {
    console.error('Error fetching user articles:', error);
    return [];
  }
}

export default async function UserArticlesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const articles = await getUserArticles(userId);

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
        <h1 className="text-3xl font-bold text-gray-900">Your Articles</h1>
        <p className="text-gray-600 mt-2">
          A complete list of articles you've read
        </p>
      </div>

      {articles.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {articles.length} Articles Read
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {articles.map((article) => {
              const successRate = article.totalQuestions > 0 
                ? Math.round((article.correctAnswers / article.totalQuestions) * 100)
                : 0;
                
              return (
                <div key={article.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start space-x-4">
                        <BookOpen className="h-6 w-6 text-blue-600 mt-1" />
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {article.title}
                          </h3>
                          <div className="flex items-center space-x-6 text-sm text-gray-500 mb-3">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              Last accessed: {article.lastAccessed.toLocaleDateString()}
                            </div>
                          </div>
                          {article.hasQuizResponses ? (
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-gray-900">{article.totalQuestions}</span>
                                <span className="text-gray-500 ml-1">Questions Answered</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">{article.correctAnswers}</span>
                                <span className="text-gray-500 ml-1">Correct</span>
                              </div>
                              <div>
                                <span className={`font-medium ${successRate >= 70 ? 'text-green-600' : successRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {successRate}%
                                </span>
                                <span className="text-gray-500 ml-1">Success Rate</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">
                              No quiz questions answered yet
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/articles/${article.slug}`}
                      className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Read Article
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No articles read yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Start exploring articles to see your reading history here.
          </p>
          <div className="mt-6">
            <Link
              href="/categories"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Browse Articles
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}