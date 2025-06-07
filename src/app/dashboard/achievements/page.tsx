import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Trophy, TrendingUp, Target, Award, ArrowLeft, Lightbulb } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";


export const dynamic = 'force-dynamic';
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  progress: number;
  target: number;
  unlocked: boolean;
  color: string;
}

async function getUserAchievements(userId: string): Promise<{
  correctAnswers: number;
  totalQuestions: number;
  approvedSuggestions: number;
  achievements: Achievement[];
}> {
  try {
    const userResponses = await prisma.userResponse.findMany({
      where: { clerkUserId: userId }
    });

    const totalQuestions = userResponses.length;
    const correctAnswers = userResponses.filter(r => r.isCorrect).length;

    // Get approved suggestions count
    const approvedSuggestions = await prisma.articleSuggestion.count({
      where: {
        clerkUserId: userId,
        isApproved: true
      }
    });

    // Get suggestion settings for badge thresholds
    const settings = await prisma.suggestionSettings.findFirst();
    const thresholds = (settings?.badgeThresholds as { bronze?: number; silver?: number; gold?: number }) || { bronze: 5, silver: 10, gold: 25 };

    const achievements: Achievement[] = [
      {
        id: 'first_correct',
        title: 'First Success',
        description: 'Answer your first question correctly',
        icon: Target,
        progress: correctAnswers,
        target: 1,
        unlocked: correctAnswers >= 1,
        color: 'green'
      },
      {
        id: 'ten_correct',
        title: 'Getting Started',
        description: 'Answer 10 questions correctly',
        icon: TrendingUp,
        progress: correctAnswers,
        target: 10,
        unlocked: correctAnswers >= 10,
        color: 'blue'
      },
      {
        id: 'fifty_correct',
        title: 'Knowledge Builder',
        description: 'Answer 50 questions correctly',
        icon: Trophy,
        progress: correctAnswers,
        target: 50,
        unlocked: correctAnswers >= 50,
        color: 'yellow'
      },
      {
        id: 'hundred_correct',
        title: 'Quiz Master',
        description: 'Answer 100 questions correctly',
        icon: Award,
        progress: correctAnswers,
        target: 100,
        unlocked: correctAnswers >= 100,
        color: 'purple'
      },
      {
        id: 'high_accuracy',
        title: 'Precision Expert',
        description: 'Maintain 80% accuracy with at least 20 questions',
        icon: Target,
        progress: totalQuestions >= 20 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
        target: 80,
        unlocked: totalQuestions >= 20 && (correctAnswers / totalQuestions) >= 0.8,
        color: 'indigo'
      },
      // Suggestion badges
      {
        id: 'first_suggestion',
        title: 'Content Contributor',
        description: 'Get your first article suggestion approved',
        icon: Lightbulb,
        progress: approvedSuggestions,
        target: 1,
        unlocked: approvedSuggestions >= 1,
        color: 'orange'
      },
      {
        id: 'bronze_contributor',
        title: 'Bronze Contributor',
        description: `Get ${thresholds.bronze} article suggestions approved`,
        icon: Lightbulb,
        progress: approvedSuggestions,
        target: thresholds.bronze,
        unlocked: approvedSuggestions >= thresholds.bronze,
        color: 'amber'
      },
      {
        id: 'silver_contributor',
        title: 'Silver Contributor',
        description: `Get ${thresholds.silver} article suggestions approved`,
        icon: Lightbulb,
        progress: approvedSuggestions,
        target: thresholds.silver,
        unlocked: approvedSuggestions >= thresholds.silver,
        color: 'gray'
      },
      {
        id: 'gold_contributor',
        title: 'Gold Contributor',
        description: `Get ${thresholds.gold} article suggestions approved`,
        icon: Lightbulb,
        progress: approvedSuggestions,
        target: thresholds.gold,
        unlocked: approvedSuggestions >= thresholds.gold,
        color: 'yellow'
      }
    ];

    return {
      correctAnswers,
      totalQuestions,
      approvedSuggestions,
      achievements
    };
      
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return {
      correctAnswers: 0,
      totalQuestions: 0,
      approvedSuggestions: 0,
      achievements: []
    };
  }
}

export default async function AchievementsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const { correctAnswers, totalQuestions, approvedSuggestions, achievements } = await getUserAchievements(userId);
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const successRate = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  const getColorClasses = (color: string, unlocked: boolean) => {
    if (!unlocked) return 'bg-gray-100 text-gray-400';
    
    switch (color) {
      case 'green': return 'bg-green-100 text-green-600';
      case 'blue': return 'bg-blue-100 text-blue-600';
      case 'yellow': return 'bg-yellow-100 text-yellow-600';
      case 'purple': return 'bg-purple-100 text-purple-600';
      case 'indigo': return 'bg-indigo-100 text-indigo-600';
      case 'orange': return 'bg-orange-100 text-orange-600';
      case 'amber': return 'bg-amber-100 text-amber-600';
      case 'gray': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

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
        <h1 className="text-3xl font-bold text-gray-900">Your Achievements</h1>
        <p className="text-gray-600 mt-2">
          Track your progress and unlock achievements as you learn
        </p>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Award className="h-8 w-8 text-gold-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Achievements Unlocked</p>
              <p className="text-2xl font-semibold text-gray-900">{unlockedCount} / {achievements.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Correct Answers</p>
              <p className="text-2xl font-semibold text-gray-900">{correctAnswers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Accuracy Rate</p>
              <p className={`text-2xl font-semibold ${
                successRate >= 70 ? 'text-green-600' : successRate >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {successRate}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Lightbulb className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Approved Suggestions</p>
              <p className="text-2xl font-semibold text-gray-900">{approvedSuggestions}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">All Achievements</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {achievements.map((achievement) => {
            const Icon = achievement.icon;
            const progressPercentage = Math.min((achievement.progress / achievement.target) * 100, 100);
            
            return (
              <div
                key={achievement.id}
                className={`p-6 rounded-lg border-2 ${
                  achievement.unlocked 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-gray-200 bg-gray-50'
                } transition-all duration-200`}
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-lg ${getColorClasses(achievement.color, achievement.unlocked)}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className={`font-semibold ${achievement.unlocked ? 'text-gray-900' : 'text-gray-500'}`}>
                        {achievement.title}
                      </h3>
                      {achievement.unlocked && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Unlocked
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mb-3 ${achievement.unlocked ? 'text-gray-600' : 'text-gray-400'}`}>
                      {achievement.description}
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className={achievement.unlocked ? 'text-gray-600' : 'text-gray-400'}>
                          Progress: {achievement.progress} / {achievement.target}
                        </span>
                        <span className={achievement.unlocked ? 'text-gray-600' : 'text-gray-400'}>
                          {Math.round(progressPercentage)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            achievement.unlocked ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {unlockedCount === 0 && (
        <div className="text-center py-12">
          <Trophy className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No achievements yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Start answering questions correctly to unlock your first achievement!
          </p>
          <div className="mt-6">
            <Link
              href="/categories"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Start Learning
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}