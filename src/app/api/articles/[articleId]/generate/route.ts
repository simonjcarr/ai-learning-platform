import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";

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

    if (article.isContentGenerated && article.contentHtml) {
      return NextResponse.json({
        message: "Content already generated",
        article
      });
    }

    // Generate content using OpenAI
    const prompt = `Generate a comprehensive, high-quality tutorial or blog post for an IT professional on the topic: "${article.articleTitle}" within the broader context of "${article.category.categoryName}". 

The content should be:
- Informative, accurate, practical, and well-structured
- Include headings using markdown (##, ###), subheadings, paragraphs, bullet points/lists
- Include code examples with proper markdown code blocks with language specification (e.g., \`\`\`bash, \`\`\`python, \`\`\`javascript)
- Have clear explanations with inline code using backticks
- Be professional yet accessible
- Up-to-date and relevant for an IT audience
- At least 1000 words

The output must be in Markdown format. Use proper markdown syntax throughout.
Include practical examples, best practices, and common pitfalls to avoid.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-0125-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert IT instructor creating comprehensive learning materials. Generate well-structured Markdown content with proper syntax, code blocks, and formatting."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    const generatedContent = completion.choices[0].message.content;

    // Update the article with generated content
    const updatedArticle = await prisma.article.update({
      where: { articleId },
      data: {
        contentHtml: generatedContent,
        isContentGenerated: true,
        updatedAt: new Date()
      },
      include: { category: true }
    });

    return NextResponse.json({
      message: "Content generated successfully",
      article: updatedArticle
    });

  } catch (error) {
    console.error("Error generating content:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}