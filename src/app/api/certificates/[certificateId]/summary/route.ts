import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { certificateId } = await params;

    // Get the certificate with full course data
    const certificate = await prisma.courseCertificate.findUnique({
      where: { certificateId },
      include: {
        course: {
          include: {
            sections: {
              include: {
                articles: {
                  select: {
                    articleId: true,
                    title: true,
                    description: true,
                    orderIndex: true,
                    contentHtml: true,
                  },
                  orderBy: {
                    orderIndex: 'asc',
                  },
                },
                quizzes: {
                  select: {
                    quizId: true,
                    title: true,
                    description: true,
                    _count: {
                      select: {
                        questions: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                orderIndex: 'asc',
              },
            },
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!certificate) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 }
      );
    }

    // Ensure the certificate belongs to the requesting user
    if (certificate.clerkUserId !== user.clerkUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Get course progress for this user to show completion details
    const courseProgress = await prisma.courseProgress.findMany({
      where: {
        clerkUserId: user.clerkUserId,
        articleId: {
          in: certificate.course.sections.flatMap(s => s.articles.map(a => a.articleId))
        }
      },
      select: {
        articleId: true,
        isCompleted: true,
        completedAt: true,
        engagementScore: true,
        timeSpent: true,
      }
    });

    // Get quiz attempts for this course
    const quizAttempts = await prisma.courseQuizAttempt.findMany({
      where: {
        clerkUserId: user.clerkUserId,
        quiz: {
          OR: [
            { courseId: certificate.courseId },
            { sectionId: { in: certificate.course.sections.map(s => s.sectionId) } },
            { articleId: { in: certificate.course.sections.flatMap(s => s.articles.map(a => a.articleId)) } },
          ],
        },
      },
      include: {
        quiz: {
          select: {
            quizId: true,
            title: true,
            articleId: true,
            sectionId: true,
            courseId: true,
            quizType: true,
          },
        },
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    // Process the data for summary
    const progressMap = new Map(courseProgress.map(p => [p.articleId, p]));
    const quizAttemptsMap = new Map();
    
    quizAttempts.forEach(attempt => {
      const key = attempt.quiz.articleId || attempt.quiz.sectionId || attempt.quiz.courseId;
      if (!quizAttemptsMap.has(key)) {
        quizAttemptsMap.set(key, []);
      }
      quizAttemptsMap.get(key).push(attempt);
    });

    const courseSummary = {
      certificate: {
        certificateId: certificate.certificateId,
        issuedAt: certificate.issuedAt,
        grade: certificate.grade,
        finalScore: certificate.finalScore,
        engagementScore: certificate.engagementScore,
        certificateData: certificate.certificateData,
      },
      course: {
        courseId: certificate.course.courseId,
        title: certificate.course.title,
        slug: certificate.course.slug,
        description: certificate.course.description,
        level: certificate.course.level,
        estimatedHours: certificate.course.estimatedHours,
        passMarkPercentage: certificate.course.passMarkPercentage,
      },
      user: certificate.user,
      sections: certificate.course.sections.map(section => {
        const sectionQuizzes = quizAttemptsMap.get(section.sectionId) || [];
        const bestSectionQuiz = sectionQuizzes.length > 0 ? 
          sectionQuizzes.reduce((best, current) => 
            (current.score || 0) > (best.score || 0) ? current : best
          ) : null;

        return {
          sectionId: section.sectionId,
          title: section.title,
          description: section.description,
          orderIndex: section.orderIndex,
          articles: section.articles.map(article => {
            const progress = progressMap.get(article.articleId);
            const articleQuizzes = quizAttemptsMap.get(article.articleId) || [];
            const bestArticleQuiz = articleQuizzes.length > 0 ?
              articleQuizzes.reduce((best, current) => 
                (current.score || 0) > (best.score || 0) ? current : best
              ) : null;

            // Extract a brief summary from content (first 200 chars of text content)
            let contentSummary = '';
            if (article.contentHtml) {
              // Simple HTML to text extraction
              const textContent = article.contentHtml
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              contentSummary = textContent.length > 200 
                ? textContent.substring(0, 200) + '...' 
                : textContent;
            }

            return {
              articleId: article.articleId,
              title: article.title,
              description: article.description,
              orderIndex: article.orderIndex,
              contentSummary,
              isCompleted: progress?.isCompleted || false,
              completedAt: progress?.completedAt,
              engagementScore: progress?.engagementScore,
              timeSpent: progress?.timeSpent,
              bestQuizScore: bestArticleQuiz?.score,
              quizPassed: bestArticleQuiz?.passed,
            };
          }),
          bestQuizScore: bestSectionQuiz?.score,
          quizPassed: bestSectionQuiz?.passed,
          totalArticles: section.articles.length,
          completedArticles: section.articles.filter(a => 
            progressMap.get(a.articleId)?.isCompleted
          ).length,
        };
      }),
      courseMetrics: {
        totalSections: certificate.course.sections.length,
        totalArticles: certificate.course.sections.reduce((sum, s) => sum + s.articles.length, 0),
        completedArticles: courseProgress.filter(p => p.isCompleted).length,
        totalTimeSpent: courseProgress.reduce((sum, p) => sum + (p.timeSpent || 0), 0),
        averageEngagement: courseProgress.length > 0 
          ? courseProgress.reduce((sum, p) => sum + (p.engagementScore || 0), 0) / courseProgress.length
          : 0,
      },
    };

    return NextResponse.json(courseSummary);
  } catch (error) {
    console.error("Failed to fetch certificate summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch certificate summary" },
      { status: 500 }
    );
  }
}