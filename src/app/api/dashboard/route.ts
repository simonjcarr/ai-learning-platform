import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user stats
    const [
      totalResponses,
      correctResponses,
      articlesViewed,
      recentActivity,
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
      
      // Recent article views for streak calculation
      prisma.userArticleView.findMany({
        where: { clerkUserId: userId },
        orderBy: { viewedAt: 'desc' },
        take: 30
      })
    ]);

    // Calculate learning streak based on article views (consecutive days with views)
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

    const stats = {
      articlesRead: articlesViewed,
      quizzesTaken: totalResponses,
      correctAnswers: correctResponses,
      learningStreak: learningStreak,
      recentActivity: formattedActivity
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}