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
      uniqueArticlesAnswered,
      recentActivity
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
      
      // Count unique articles where user has answered questions
      prisma.userResponse.findMany({
        where: { clerkUserId: userId },
        select: {
          example: {
            select: {
              articleId: true
            }
          }
        },
        distinct: ['exampleId']
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
      })
    ]);

    // Count unique articles
    const uniqueArticleIds = new Set(
      uniqueArticlesAnswered.map(response => response.example.articleId)
    );

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

    // Mark days with activity
    recentActivity.forEach(response => {
      const responseDate = response.submittedAt.toDateString();
      const dayIndex = recentDays.findIndex(day => day.date === responseDate);
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
      articlesRead: uniqueArticleIds.size,
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