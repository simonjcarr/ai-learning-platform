import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { quizId } = await params;
    const { answers } = await request.json();

    // Fetch the quiz with questions and related course
    const quiz = await prisma.courseQuiz.findUnique({
      where: { quizId },
      include: {
        questions: true,
        course: true,
        section: {
          include: {
            course: true,
          },
        },
        article: {
          include: {
            section: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Get the course (from different relationships)
    const course = quiz.course || quiz.section?.course || quiz.article?.section?.course;
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Check if user has exceeded max attempts
    if (quiz.maxAttempts) {
      const attemptCount = await prisma.courseQuizAttempt.count({
        where: {
          quizId,
          clerkUserId: user.clerkUserId,
        },
      });

      if (attemptCount >= quiz.maxAttempts) {
        return NextResponse.json(
          { error: "Maximum attempts exceeded" },
          { status: 403 }
        );
      }
    }

    // Create the quiz attempt
    const startTime = new Date();
    const attempt = await prisma.courseQuizAttempt.create({
      data: {
        quizId,
        clerkUserId: user.clerkUserId,
        startedAt: startTime,
      },
    });

    // Calculate score and create answer records
    let totalPoints = 0;
    let earnedPoints = 0;
    const feedback: Record<string, { isCorrect: boolean; explanation: string | null }> = {};

    for (const question of quiz.questions) {
      totalPoints += question.points;
      const userAnswer = answers[question.questionId];
      
      let isCorrect = false;
      if (userAnswer) {
        switch (question.questionType) {
          case "MULTIPLE_CHOICE":
            isCorrect = userAnswer === question.correctAnswer;
            break;
          case "TRUE_FALSE":
            isCorrect = userAnswer.toLowerCase() === question.correctAnswer.toLowerCase();
            break;
          case "FILL_IN_BLANK":
            // Case-insensitive comparison with trimming
            isCorrect = userAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
            break;
          case "ESSAY":
            // Essays would typically need manual grading or AI evaluation
            // For now, we'll just mark it as correct if something was written
            isCorrect = userAnswer.trim().length > 10; // Require at least 10 characters
            break;
          default:
            isCorrect = false;
        }
      }

      if (isCorrect) {
        earnedPoints += question.points;
      }

      // Create answer record
      await prisma.courseQuizAnswer.create({
        data: {
          attemptId: attempt.attemptId,
          questionId: question.questionId,
          userAnswer: userAnswer || "",
          isCorrect,
          pointsEarned: isCorrect ? question.points : 0,
        },
      });

      feedback[question.questionId] = {
        isCorrect,
        explanation: question.explanation,
      };
    }

    // Calculate percentage score
    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const passed = score >= quiz.passMarkPercentage;

    // Update attempt with results
    await prisma.courseQuizAttempt.update({
      where: { attemptId: attempt.attemptId },
      data: {
        completedAt: new Date(),
        score,
        passed,
        timeSpent: Math.floor((new Date().getTime() - startTime.getTime()) / 1000),
      },
    });

    // If this is a final exam, also record in FinalExamAttempt table
    if (quiz.quizType === 'final_exam') {
      const cooldownHours = quiz.cooldownHours || 24;
      const nextRetakeTime = new Date();
      nextRetakeTime.setHours(nextRetakeTime.getHours() + cooldownHours);

      await prisma.finalExamAttempt.create({
        data: {
          courseId: course.courseId,
          clerkUserId: user.clerkUserId,
          score,
          passed,
          canRetakeAt: passed ? null : nextRetakeTime,
        },
      });

      // If passed, potentially generate certificate
      if (passed) {
        // TODO: Implement certificate generation with grade calculation
        console.log(`Student ${user.clerkUserId} passed final exam for course ${course.courseId} with score ${score}%`);
      }
    }

    return NextResponse.json({
      score,
      passed,
      feedback,
    });
  } catch (error) {
    console.error("Failed to submit quiz:", error);
    return NextResponse.json(
      { error: "Failed to submit quiz" },
      { status: 500 }
    );
  }
}