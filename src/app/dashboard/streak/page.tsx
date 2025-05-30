import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Calendar, Flame, TrendingUp, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  activeDays: Set<string>;
  totalActiveDays: number;
  streakHistory: Array<{
    date: string;
    hasActivity: boolean;
    questionsAnswered: number;
  }>;
}

async function getUserStreakData(userId: string): Promise<StreakData> {
  try {
    const userResponses = await prisma.userResponse.findMany({
      where: { clerkUserId: userId },
      orderBy: { submittedAt: 'desc' }
    });

    // Get last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    // Create array of last 30 days
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toDateString(),
        hasActivity: false,
        questionsAnswered: 0
      });
    }

    // Count activity per day
    const dailyActivity = new Map<string, number>();
    userResponses.forEach(response => {
      const dateStr = response.submittedAt.toDateString();
      dailyActivity.set(dateStr, (dailyActivity.get(dateStr) || 0) + 1);
    });

    // Mark days with activity
    days.forEach(day => {
      const count = dailyActivity.get(day.date) || 0;
      day.hasActivity = count > 0;
      day.questionsAnswered = count;
    });

    // Calculate current streak (from today backwards)
    let currentStreak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].hasActivity) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate longest streak in the 30-day period
    let longestStreak = 0;
    let tempStreak = 0;
    days.forEach(day => {
      if (day.hasActivity) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    });

    // Get all unique active days
    const activeDays = new Set<string>();
    userResponses.forEach(response => {
      activeDays.add(response.submittedAt.toDateString());
    });

    return {
      currentStreak,
      longestStreak,
      activeDays,
      totalActiveDays: activeDays.size,
      streakHistory: days
    };
      
  } catch (error) {
    console.error('Error fetching streak data:', error);
    return {
      currentStreak: 0,
      longestStreak: 0,
      activeDays: new Set(),
      totalActiveDays: 0,
      streakHistory: []
    };
  }
}

export default async function StreakPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const streakData = await getUserStreakData(userId);

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
        <h1 className="text-3xl font-bold text-gray-900">Your Learning Streak</h1>
        <p className="text-gray-600 mt-2">
          Track your daily learning consistency and build lasting habits
        </p>
      </div>

      {/* Streak Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Flame className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Current Streak</p>
              <p className="text-2xl font-semibold text-gray-900">
                {streakData.currentStreak} day{streakData.currentStreak !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Longest Streak (30 days)</p>
              <p className="text-2xl font-semibold text-gray-900">
                {streakData.longestStreak} day{streakData.longestStreak !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Active Days</p>
              <p className="text-2xl font-semibold text-gray-900">{streakData.totalActiveDays}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Calendar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Last 30 Days Activity</h2>
        
        <div className="grid grid-cols-7 gap-2 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {streakData.streakHistory.map((day, index) => {
            const date = new Date(day.date);
            const isToday = date.toDateString() === new Date().toDateString();
            
            return (
              <div
                key={index}
                className={`
                  aspect-square flex items-center justify-center text-sm rounded-md border
                  ${day.hasActivity 
                    ? 'bg-green-100 border-green-300 text-green-800' 
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                  }
                  ${isToday ? 'ring-2 ring-blue-500' : ''}
                `}
                title={`${date.toLocaleDateString()}: ${day.questionsAnswered} questions answered`}
              >
                <div className="text-center">
                  <div className="font-medium">{date.getDate()}</div>
                  {day.hasActivity && (
                    <div className="text-xs mt-1">
                      {day.questionsAnswered}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center space-x-6 mt-6 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
            <span>No activity</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span>Active day</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Streak Tips */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">
          💡 Tips to Build Your Learning Streak
        </h3>
        <ul className="space-y-2 text-blue-800">
          <li>• Set a daily goal of answering at least 3-5 quiz questions</li>
          <li>• Study at the same time each day to build a routine</li>
          <li>• Start with easier topics when you&apos;re building momentum</li>
          <li>• Don&apos;t break the chain - consistency beats intensity</li>
          <li>• Review incorrect answers to reinforce learning</li>
        </ul>
      </div>

      {streakData.currentStreak === 0 && (
        <div className="text-center py-12">
          <Flame className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Start Your Learning Streak</h3>
          <p className="mt-1 text-sm text-gray-500">
            Answer some quiz questions today to begin building your learning habit!
          </p>
          <div className="mt-6">
            <Link
              href="/categories"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Start Learning Today
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}