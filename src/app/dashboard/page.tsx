import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';
import { BookOpen, Trophy, Clock, TrendingUp, CheckCircle, XCircle, Heart, BookmarkIcon, GraduationCap, Award, User } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SubscriptionStatus } from "@/components/subscription-status";
// import { Role } from "@prisma/client";

interface DashboardStats {
  articlesRead: number;
  quizzesTaken: number;
  correctAnswers: number;
  learningStreak: number;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    articleTitle: string;
    articleSlug: string;
    timestamp: Date;
    isCorrect: boolean;
  }>;
  recentArticles: Array<{
    id: string;
    title: string;
    slug: string;
    lastAccessed: Date;
  }>;
}

async function getDashboardStats(userId: string): Promise<DashboardStats> {
  try {
    // Get user stats
    const [
      totalResponses,
      correctResponses,
      articlesViewed,
      recentActivity,
      allUserArticles,
      recentViews
    ] = await Promise.all([
      // Total quiz responses
      prisma.userResponse.count({
        where: { clerkUserId: userId }
      }),
      
      // Correct responses
      prisma.userResponse.count({
        where: { 
          clerkUserId: userId,
          isCorrect: true 
        }
      }),
      
      // Count articles viewed (from UserArticleView table)
      prisma.userArticleView.count({
        where: { clerkUserId: userId }
      }),
      
      // Recent activity (last 10 responses)
      prisma.userResponse.findMany({
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
        orderBy: { submittedAt: 'desc' },
        take: 10
      }),
      
      // Recent articles (unique articles with latest access time)
      prisma.userResponse.findMany({
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
      }),
      
      // Recent article views for streak calculation
      prisma.userArticleView.findMany({
        where: { clerkUserId: userId },
        orderBy: { viewedAt: 'desc' },
        take: 30
      })
    ]);

    // Calculate learning streak (simplified - consecutive days with activity)
    const today = new Date();
    const recentDays = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      recentDays.push({
        date: date.toDateString(),
        hasActivity: false
      });
    }

    // Mark days with article views
    recentViews.forEach(view => {
      const viewDate = view.viewedAt.toDateString();
      const dayIndex = recentDays.findIndex(day => day.date === viewDate);
      if (dayIndex !== -1) {
        recentDays[dayIndex].hasActivity = true;
      }
    });

    // Calculate streak from today backwards
    let learningStreak = 0;
    for (const day of recentDays) {
      if (day.hasActivity) {
        learningStreak++;
      } else {
        break;
      }
    }

    // Format recent activity for display
    const formattedActivity = recentActivity.map(response => ({
      id: response.responseId,
      type: response.isCorrect ? 'correct_answer' : 'incorrect_answer',
      description: `${response.isCorrect ? 'Correctly answered' : 'Answered'} question in "${response.example.article.articleTitle}"`,
      articleTitle: response.example.article.articleTitle,
      articleSlug: response.example.article.articleSlug,
      timestamp: response.submittedAt,
      isCorrect: response.isCorrect
    }));

    // Get unique recent articles with latest access time
    const articleMap = new Map();
    allUserArticles.forEach(response => {
      const article = response.example.article;
      if (!articleMap.has(article.articleId) || 
          articleMap.get(article.articleId).lastAccessed < response.submittedAt) {
        articleMap.set(article.articleId, {
          id: article.articleId,
          title: article.articleTitle,
          slug: article.articleSlug,
          lastAccessed: response.submittedAt
        });
      }
    });
    
    const recentArticles = Array.from(articleMap.values())
      .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
      .slice(0, 5);

    return {
      articlesRead: articlesViewed,
      quizzesTaken: totalResponses,
      correctAnswers: correctResponses,
      learningStreak: learningStreak,
      recentActivity: formattedActivity,
      recentArticles: recentArticles
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      articlesRead: 0,
      quizzesTaken: 0,
      correctAnswers: 0,
      learningStreak: 0,
      recentActivity: [],
      recentArticles: []
    };
  }
}

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const stats = await getDashboardStats(userId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
        <Link href="/dashboard/articles" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Articles Read</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.articlesRead}</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/quizzes" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center">
            <Trophy className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Quizzes Taken</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.quizzesTaken}</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/achievements" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Correct Answers</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.correctAnswers}</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/streak" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Learning Streak</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.learningStreak} days</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/liked" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center">
            <Heart className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Liked Articles</p>
              <p className="text-2xl font-semibold text-gray-900">View All</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/lists" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center">
            <BookmarkIcon className="h-8 w-8 text-indigo-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">My Lists</p>
              <p className="text-2xl font-semibold text-gray-900">Manage</p>
            </div>
          </div>
        </Link>

        <Link href="/courses" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center">
            <GraduationCap className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Courses</p>
              <p className="text-2xl font-semibold text-gray-900">Browse</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/certificates" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center">
            <Award className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Certificates</p>
              <p className="text-2xl font-semibold text-gray-900">View All</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/portfolio" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center">
            <User className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Portfolio</p>
              <p className="text-2xl font-semibold text-gray-900">Manage</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Subscription Status and Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Subscription Status - Takes up 1 column */}
        <div className="lg:col-span-1">
          <SubscriptionStatus />
        </div>

        {/* Recent Quiz Results and Recent Articles - Takes up 2 columns */}
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Quiz Results */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Quiz Results</h2>
        {stats.recentActivity.length > 0 ? (
          <div className="space-y-4">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center space-x-3">
                  {activity.isCorrect ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activity.timestamp.toLocaleDateString()} at{' '}
                      {activity.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/articles/${activity.articleSlug}`}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View Article
                </Link>
              </div>
            ))}
          </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No quiz results yet. Start taking quizzes to see your progress here!</p>
            </div>
          )}
        </div>

        {/* Recently Read Articles */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recently Read Articles</h2>
          {stats.recentArticles.length > 0 ? (
            <div className="space-y-4">
              {stats.recentArticles.map((article) => (
                <div key={article.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <BookOpen className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {article.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        Last accessed: {article.lastAccessed.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/articles/${article.slug}`}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Read Again
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No articles read yet. Start reading to see your recent articles here!</p>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}