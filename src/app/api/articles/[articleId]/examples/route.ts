import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { openai, ExampleGenerationResponse } from "@/lib/openai";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await params;
  try {
    const examples = await prisma.interactiveExample.findMany({
      where: { articleId },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json(examples);
  } catch (error) {
    console.error("Error fetching examples:", error);
    return NextResponse.json(
      { error: "Failed to fetch examples" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await params;
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const article = await prisma.article.findUnique({
      where: { articleId },
      include: { category: true }
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Get existing examples to ensure variety
    const existingExamples = await prisma.interactiveExample.findMany({
      where: { articleId },
      select: { scenarioOrQuestionText: true }
    });

    const existingQuestions = existingExamples.map(e => e.scenarioOrQuestionText);

    const prompt = `Based on the IT article titled "${article.articleTitle}" in the category "${article.category.categoryName}", generate 3-5 unique interactive examples to test understanding. 

${existingQuestions.length > 0 ? `Avoid these existing questions: ${JSON.stringify(existingQuestions)}` : ''}

For each example, provide:
1. question_type: Choose intelligently from 'multiple_choice', 'text_input', or 'command_line'
2. scenario_or_question_text: The scenario, problem, or question
3. options_json (if 'multiple_choice'): An array of 3-5 plausible options
4. correct_answer_key_or_text: The correct answer
5. correct_answer_description: Clear explanation of why the answer is correct
6. ai_marking_prompt_hint: Keywords or concepts for marking

Focus on practical, real-world scenarios that IT professionals would encounter.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-0125-preview",
      messages: [
        {
          role: "system",
          content: "You are an IT education expert creating interactive examples. Generate diverse, practical questions that test real understanding. Respond in valid JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 2000
    });

    const response: ExampleGenerationResponse = JSON.parse(
      completion.choices[0].message.content || "{}"
    );

    // Save generated examples
    const createdExamples = [];
    for (const example of response.examples || []) {
      const created = await prisma.interactiveExample.create({
        data: {
          articleId,
          questionType: example.question_type.toUpperCase().replace(' ', '_') as "MULTIPLE_CHOICE" | "TEXT_INPUT" | "COMMAND_LINE",
          scenarioOrQuestionText: example.scenario_or_question_text,
          optionsJson: example.options_json || undefined,
          correctAnswerDescription: example.correct_answer_description,
          aiMarkingPromptHint: example.ai_marking_prompt_hint
        }
      });
      createdExamples.push(created);
    }

    return NextResponse.json({
      message: "Examples generated successfully",
      examples: createdExamples
    });

  } catch (error) {
    console.error("Error generating examples:", error);
    return NextResponse.json(
      { error: "Failed to generate examples" },
      { status: 500 }
    );
  }
}