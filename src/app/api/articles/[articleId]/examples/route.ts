import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { aiService } from "@/lib/ai-service";
import { checkFeatureAccessWithAdmin, checkFeatureUsageWithAdmin } from "@/lib/feature-access-admin";

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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check feature access (admins bypass all restrictions)
    const exampleAccess = await checkFeatureAccessWithAdmin('generate_example_questions', userId);
    
    if (!exampleAccess.hasAccess) {
      return NextResponse.json(
        { error: exampleAccess.reason || "Subscription required to generate example questions" },
        { status: 403 }
      );
    }

    // Check usage limits (admins have unlimited access)
    const usageCheck = await checkFeatureUsageWithAdmin('generate_example_questions', userId, 'daily');
    
    if (!usageCheck.hasAccess) {
      return NextResponse.json(
        { 
          error: usageCheck.reason || `Daily example generation limit reached (${usageCheck.currentUsage}/${usageCheck.limit}). Upgrade for more generations.`,
          currentUsage: usageCheck.currentUsage,
          limit: usageCheck.limit,
          remaining: usageCheck.remaining
        },
        { status: 429 }
      );
    }

    const article = await prisma.article.findUnique({
      where: { articleId },
      include: { 
        categories: {
          include: {
            category: true
          }
        }
      }
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

    // Generate examples using AI service
    console.log('Generating examples with AI...');
    
    // Get the first category name (articles can have multiple categories)
    const categoryName = article.categories[0]?.category.categoryName || 'General';
    
    const response = await aiService.generateInteractiveExamples(
      article.articleTitle,
      categoryName,
      existingQuestions,
      userId
    );

    // Save generated examples
    const createdExamples = [];
    for (const example of response.examples || []) {
      // Validate and format options for multiple choice questions
      let formattedOptions = undefined;
      if (example.question_type === 'multiple_choice' && example.options_json) {
        // Ensure options have the correct format
        formattedOptions = example.options_json.map((opt, index) => {
          if (typeof opt === 'string') {
            // If options are strings, convert to proper format
            return { id: String.fromCharCode(97 + index), text: opt };
          }
          // Ensure id and text exist
          return {
            id: opt.id || String.fromCharCode(97 + index),
            text: opt.text || 'Option ' + (index + 1)
          };
        });
      }

      const created = await prisma.interactiveExample.create({
        data: {
          articleId,
          questionType: example.question_type.toUpperCase().replace(' ', '_') as "MULTIPLE_CHOICE" | "TEXT_INPUT" | "COMMAND_LINE",
          scenarioOrQuestionText: example.scenario_or_question_text,
          optionsJson: formattedOptions,
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