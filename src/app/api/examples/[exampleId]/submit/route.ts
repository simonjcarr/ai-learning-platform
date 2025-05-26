import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { openai, MarkingResponse } from "@/lib/openai";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ exampleId: string }> }
) {
  const { exampleId } = await params;
  try {
    const user = await currentUser();
    const userId = user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
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

    // Use AI to mark the answer
    const markingPrompt = `Evaluate the user's answer for this IT question.

Question Type: ${example.questionType}
Question: ${example.scenarioOrQuestionText}
${example.optionsJson ? `Options: ${JSON.stringify(example.optionsJson)}` : ''}
User's Answer: ${userAnswer}
Correct Answer Description: ${example.correctAnswerDescription}
Marking Hint: ${example.aiMarkingPromptHint || 'None'}

Determine if the user's answer is correct. For text or command inputs, allow for minor syntactic variations if they achieve the same semantic result. Provide concise, helpful feedback explaining why the answer is correct or incorrect.

Respond in JSON format with:
- is_correct: boolean
- feedback: string (constructive feedback)`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-0125-preview",
      messages: [
        {
          role: "system",
          content: "You are an IT education expert marking student answers. Be fair but thorough. Accept reasonable variations for command-line and text answers. Always provide constructive feedback."
        },
        {
          role: "user",
          content: markingPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500
    });

    const markingResult: MarkingResponse = JSON.parse(
      completion.choices[0].message.content || "{}"
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