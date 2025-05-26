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
}

async function getUserArticles(userId: string): Promise<ArticleData[]> {
  try {
    // Get all user responses with article info
    const userResponses = await prisma.userResponse.findMany({
      where: { clerkUserId: userId },
      include: {
        example: {
          include: {
            article: {
              select: {
                articleId: true,
                articleTitle: true,
                articleSlug: true
              }
            }
          }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    // Group by article and calculate stats
    const articleMap = new Map<string, ArticleData>();
    
    userResponses.forEach(response => {
      const article = response.example.article;
      const articleId = article.articleId;
      
      if (!articleMap.has(articleId)) {
        articleMap.set(articleId, {
          id: articleId,
          title: article.articleTitle,
          slug: article.articleSlug,
          lastAccessed: response.submittedAt,
          quizzesTaken: 0,
          correctAnswers: 0,
          totalQuestions: 0
        });
      }
      
      const articleData = articleMap.get(articleId)!;
      
      // Update last accessed if this is more recent
      if (response.submittedAt > articleData.lastAccessed) {
        articleData.lastAccessed = response.submittedAt;
      }
      
      // Count quiz stats
      articleData.totalQuestions++;
      if (response.isCorrect) {
        articleData.correctAnswers++;
      }
    });

    // Convert to array and sort by last accessed
    return Array.from(articleMap.values())
      .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
      
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
          A complete list of articles you've read and practiced with quizzes
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