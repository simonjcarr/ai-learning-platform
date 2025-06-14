import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { aiService } from "@/lib/ai-service";
import { checkFeatureAccessWithAdmin } from "@/lib/feature-access-admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ exampleId: string }> }
) {
  const { exampleId } = await params;
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check feature access for AI answer marking (admins bypass all restrictions)
    const markingAccess = await checkFeatureAccessWithAdmin('ai_chat', userId);
    
    if (!markingAccess.hasAccess) {
      return NextResponse.json(
        { error: markingAccess.reason || "Subscription required for AI answer marking" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userAnswer } = body;

    if (!userAnswer || userAnswer.trim().length === 0) {
      return NextResponse.json(
        { error: "Answer is required" },
        { status: 400 }
      );
    }

    // Get the example with its correct answer
    const example = await prisma.interactiveExample.findUnique({
      where: { exampleId }
    });

    if (!example) {
      return NextResponse.json(
        { error: "Example not found" },
        { status: 404 }
      );
    }

    // For multiple choice, we'll use AI to determine correctness
    // The correct answer handling will be done by the AI marking system

    // Use AI service to mark the answer
    console.log('Marking answer with AI...');
    
    const markingResult = await aiService.markUserAnswer(
      example.scenarioOrQuestionText,
      userAnswer,
      example.questionType,
      example.aiMarkingPromptHint || undefined,
      userId
    );

    // Save the user's response
    const userResponse = await prisma.userResponse.create({
      data: {
        clerkUserId: userId,
        exampleId,
        userAnswerText: userAnswer,
        isCorrect: markingResult.is_correct,
        aiFeedback: markingResult.feedback
      }
    });

    return NextResponse.json({
      isCorrect: markingResult.is_correct,
      feedback: markingResult.feedback,
      correctAnswerDescription: example.correctAnswerDescription,
      userResponse
    });

  } catch (error) {
    console.error("Error submitting answer:", error);
    return NextResponse.json(
      { error: "Failed to submit answer" },
      { status: 500 }
    );
  }
}