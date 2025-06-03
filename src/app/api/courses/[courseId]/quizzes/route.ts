import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courseId } = await params;

    // Verify enrollment
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: {
        courseId,
        clerkUserId: user.clerkUserId,
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: "Not enrolled in course" }, { status: 400 });
    }

    // Fetch final exam quizzes for this course
    const quizzes = await prisma.courseQuiz.findMany({
      where: {
        courseId,
        quizType: 'final_exam',
      },
      include: {
        questions: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
    });

    // Parse the optionsJson for each question
    const parsedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      questions: quiz.questions.map(question => {
        let options = null;
        
        if (question.optionsJson) {
          const parsed = typeof question.optionsJson === 'string' 
            ? JSON.parse(question.optionsJson)
            : question.optionsJson;
          
          // Convert object format {a: "Option A", b: "Option B"} to array format
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            options = Object.entries(parsed).map(([key, text]) => ({
              key,
              text: text as string
            }));
          } else if (Array.isArray(parsed)) {
            options = parsed;
          }
        }
        
        return {
          ...question,
          optionsJson: options,
        };
      }),
    }));

    // Fetch user's previous attempts for these quizzes
    const quizIds = quizzes.map(q => q.quizId);
    const attempts = await prisma.courseQuizAttempt.findMany({
      where: {
        quizId: { in: quizIds },
        clerkUserId: user.clerkUserId,
      },
      select: {
        attemptId: true,
        quizId: true,
        score: true,
        passed: true,
        completedAt: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    // Group attempts by quiz ID
    const attemptsByQuiz = attempts.reduce((acc, attempt) => {
      if (!acc[attempt.quizId]) {
        acc[attempt.quizId] = [];
      }
      acc[attempt.quizId].push(attempt);
      return acc;
    }, {} as Record<string, typeof attempts>);

    return NextResponse.json({
      quizzes: parsedQuizzes,
      attempts: attemptsByQuiz,
    });
  } catch (error) {
    console.error("Failed to fetch course quizzes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quizzes" },
      { status: 500 }
    );
  }
}