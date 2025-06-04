import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    // Fetch the exam session with questions
    const session = await prisma.finalExamSession.findUnique({
      where: { sessionId },
      include: {
        questions: {
          include: {
            bankQuestion: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
        course: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Exam session not found" }, { status: 404 });
    }

    // Verify the session belongs to the current user
    if (session.clerkUserId !== user.clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if session is already completed
    if (session.completedAt) {
      return NextResponse.json({ error: "Exam session already completed" }, { status: 400 });
    }

    // Format questions for frontend
    const questions = session.questions.map((sessionQuestion, index) => {
      const question = sessionQuestion.bankQuestion;
      return {
        id: sessionQuestion.id,
        questionNumber: index + 1,
        questionType: question.questionType,
        questionText: question.questionText,
        options: question.optionsJson || null,
        points: question.points,
        // Don't send correctAnswer or explanation to prevent cheating
      };
    });

    // Get completion settings for time limit and pass mark
    const completionSettings = await prisma.courseCompletionSettings.findFirst({
      where: { settingsId: 'default' },
    });

    const timeLimit = Math.max(60, questions.length * 3); // 3 minutes per question, minimum 60 minutes
    const passMarkPercentage = completionSettings?.minQuizAverage || 65.0;

    return NextResponse.json({
      sessionId: session.sessionId,
      courseId: session.courseId,
      courseName: session.course?.title,
      startedAt: session.startedAt,
      timeLimit, // in minutes
      passMarkPercentage,
      totalQuestions: questions.length,
      questions,
    });
  } catch (error) {
    console.error("Failed to fetch exam session:", error);
    return NextResponse.json(
      { error: "Failed to fetch exam session" },
      { status: 500 }
    );
  }
}