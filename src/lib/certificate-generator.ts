import { CertificateGrade } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface CertificateData {
  courseId: string;
  clerkUserId: string;
  finalExamScore: number;
}

interface CourseStats {
  engagementScore: number;
  quizAverage: number;
  articlesCompletedPercentage: number;
  timeInvested: number;
}

export async function calculateCertificateGrade(
  finalExamScore: number,
  courseStats: CourseStats,
  settings: {
    bronzeThreshold: number;
    silverThreshold: number;
    goldThreshold: number;
  }
): Promise<{ grade: CertificateGrade; finalScore: number }> {
  // Calculate weighted final score
  // 40% final exam, 30% quiz average, 20% engagement, 10% completion
  const weightedScore = 
    (finalExamScore * 0.4) +
    (courseStats.quizAverage * 0.3) +
    (courseStats.engagementScore * 0.2) +
    (courseStats.articlesCompletedPercentage * 0.1);

  let grade: CertificateGrade;
  if (weightedScore >= settings.goldThreshold) {
    grade = CertificateGrade.GOLD;
  } else if (weightedScore >= settings.silverThreshold) {
    grade = CertificateGrade.SILVER;
  } else {
    grade = CertificateGrade.BRONZE;
  }

  return { grade, finalScore: weightedScore };
}

export async function generateCertificate(data: CertificateData) {
  try {
    // Get course details
    const course = await prisma.course.findUnique({
      where: { courseId: data.courseId },
      include: {
        createdBy: true,
      },
    });

    if (!course) {
      throw new Error("Course not found");
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { clerkUserId: data.clerkUserId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get enrollment and calculate course stats
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: {
        courseId: data.courseId,
        clerkUserId: data.clerkUserId,
      },
      include: {
        progress: true,
      },
    });

    if (!enrollment) {
      throw new Error("Enrollment not found");
    }

    // Calculate engagement score
    const engagementScores = enrollment.progress
      .filter(p => p.engagementScore !== null)
      .map(p => p.engagementScore as number);
    const avgEngagement = engagementScores.length > 0
      ? engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length
      : 0;

    // Calculate quiz average
    const quizAttempts = await prisma.courseQuizAttempt.findMany({
      where: {
        clerkUserId: data.clerkUserId,
        quiz: {
          OR: [
            { sectionId: { in: await getSectionIds(data.courseId) } },
            { articleId: { in: await getArticleIds(data.courseId) } },
          ],
        },
      },
      orderBy: { score: 'desc' },
    });

    // Group by quiz and take best score
    const quizScores = new Map<string, number>();
    quizAttempts.forEach(attempt => {
      if (attempt.score !== null) {
        const currentBest = quizScores.get(attempt.quizId) || 0;
        if (attempt.score > currentBest) {
          quizScores.set(attempt.quizId, attempt.score);
        }
      }
    });

    const avgQuizScore = quizScores.size > 0
      ? Array.from(quizScores.values()).reduce((a, b) => a + b, 0) / quizScores.size
      : 0;

    // Calculate completion percentage
    const totalArticles = await prisma.courseArticle.count({
      where: {
        section: {
          courseId: data.courseId,
        },
      },
    });

    const completedArticles = enrollment.progress.filter(p => p.isCompleted).length;
    const completionPercentage = totalArticles > 0
      ? (completedArticles / totalArticles) * 100
      : 0;

    // Calculate total time invested
    const totalTimeSeconds = enrollment.progress.reduce((sum, p) => sum + p.timeSpent, 0);
    const totalTimeHours = totalTimeSeconds / 3600;
    const displayTime = totalTimeHours >= 1 
      ? `${Math.round(totalTimeHours)}h` 
      : `${Math.round(totalTimeSeconds / 60)}m`;

    // Get completion settings
    const settings = await prisma.courseCompletionSettings.findFirst();
    if (!settings) {
      throw new Error("Course completion settings not found");
    }

    // Calculate grade
    const courseStats = {
      engagementScore: avgEngagement,
      quizAverage: avgQuizScore,
      articlesCompletedPercentage: completionPercentage,
      timeInvested: totalTimeHours,
    };

    const { grade, finalScore } = await calculateCertificateGrade(
      data.finalExamScore,
      courseStats,
      settings
    );

    // Create certificate data
    const certificateData = {
      courseName: course.title,
      courseLevel: course.level,
      studentName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      completionDate: new Date().toISOString(),
      certificateNumber: generateCertificateNumber(data.courseId, data.clerkUserId),
      grade,
      finalScore: Math.round(finalScore * 10) / 10,
      finalExamScore: Math.round(data.finalExamScore * 10) / 10,
      engagementScore: Math.round(avgEngagement * 10) / 10,
      quizAverage: Math.round(avgQuizScore * 10) / 10,
      timeInvested: displayTime,
      instructorName: `${course.createdBy.firstName || ''} ${course.createdBy.lastName || ''}`.trim() || 'IT Learning Platform',
    };

    // Create or update certificate in database
    const certificate = await prisma.courseCertificate.upsert({
      where: {
        courseId_clerkUserId: {
          courseId: data.courseId,
          clerkUserId: data.clerkUserId,
        },
      },
      update: {
        grade,
        finalScore,
        engagementScore: avgEngagement,
        certificateData: certificateData as any,
      },
      create: {
        courseId: data.courseId,
        clerkUserId: data.clerkUserId,
        grade,
        finalScore,
        engagementScore: avgEngagement,
        certificateData: certificateData as any,
      },
    });

    return certificate;
  } catch (error) {
    console.error("Failed to generate certificate:", error);
    throw error;
  }
}

function generateCertificateNumber(courseId: string, userId: string): string {
  const timestamp = Date.now().toString(36);
  const courseIdPart = courseId.slice(-4).toUpperCase();
  const userIdPart = userId.slice(-4).toUpperCase();
  return `CERT-${courseIdPart}-${userIdPart}-${timestamp}`.toUpperCase();
}

async function getSectionIds(courseId: string): Promise<string[]> {
  const sections = await prisma.courseSection.findMany({
    where: { courseId },
    select: { sectionId: true },
  });
  return sections.map(s => s.sectionId);
}

async function getArticleIds(courseId: string): Promise<string[]> {
  const articles = await prisma.courseArticle.findMany({
    where: {
      section: { courseId },
    },
    select: { articleId: true },
  });
  return articles.map(a => a.articleId);
}