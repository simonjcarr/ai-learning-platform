import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { aiService } from "@/lib/ai-service";

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

    // Generate content using AI service
    console.log(`Generating content with ${aiService.getProviderInfo().provider}...`);
    
    const result = await aiService.generateArticleContent(
      article.articleTitle,
      article.category.categoryName
    );

    const generatedContent = result.content;

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