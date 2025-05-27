import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { aiService } from "@/lib/ai-service";
import { Role } from "@prisma/client";

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

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || ![Role.ADMIN, Role.EDITOR].includes(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
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

    // Get existing tags for AI selection
    const existingTags = await prisma.tag.findMany({
      select: {
        tagId: true,
        tagName: true,
        description: true
      },
      orderBy: { tagName: 'asc' }
    });

    // Generate tag suggestions using AI
    console.log('Generating tag suggestions...');
    const tagSelection = await aiService.selectAndCreateTags(
      article.articleTitle,
      article.category.categoryName,
      existingTags
    );

    // Create new tags first
    const createdTags = [];
    for (const newTag of tagSelection.new_tags) {
      try {
        const tag = await prisma.tag.create({
          data: {
            tagName: newTag.tagName,
            description: newTag.description || null,
            color: newTag.color || null,
          }
        });
        createdTags.push(tag);
      } catch (error) {
        // If tag already exists, find it
        const existingTag = await prisma.tag.findUnique({
          where: { tagName: newTag.tagName }
        });
        if (existingTag) {
          createdTags.push(existingTag);
        }
      }
    }

    // Collect all tag IDs to assign to the article
    const allTagIds = [
      ...tagSelection.existing_tags, // Selected existing tag IDs
      ...createdTags.map(tag => tag.tagId) // New tag IDs
    ];

    // Update the article with generated content and tags
    const updatedArticle = await prisma.article.update({
      where: { articleId },
      data: {
        contentHtml: generatedContent,
        isContentGenerated: true,
        updatedAt: new Date()
      },
      include: { 
        category: true,
        tags: {
          include: {
            tag: true
          }
        }
      }
    });

    // Create article-tag relationships
    for (const tagId of allTagIds) {
      await prisma.articleTag.create({
        data: {
          articleId: article.articleId,
          tagId: tagId
        }
      }).catch(() => {}); // Ignore duplicates
    }

    // Fetch the final article with tags to return
    const finalArticle = await prisma.article.findUnique({
      where: { articleId },
      include: { 
        category: true,
        tags: {
          include: {
            tag: true
          }
        }
      }
    });

    return NextResponse.json({
      message: "Content generated successfully",
      article: finalArticle,
      tagsCreated: createdTags.length,
      tagsAssigned: allTagIds.length
    });

  } catch (error) {
    console.error("Error generating content:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}