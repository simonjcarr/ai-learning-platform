import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { aiService } from "@/lib/ai-service";
import { checkSubscription } from "@/lib/subscription-check";

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

    // Check subscription status
    const subscription = await checkSubscription(userId);
    
    if (!subscription.permissions.canGenerateContent) {
      return NextResponse.json(
        { error: "Subscription required", message: "Please subscribe to generate article content" },
        { status: 403 }
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

    if (article.isContentGenerated && article.contentHtml) {
      return NextResponse.json({
        message: "Content already generated",
        article
      });
    }

    // Find primary category or use first category
    const primaryCategory = article.categories.find(ac => ac.isPrimary)?.category 
      || article.categories[0]?.category;
    
    if (!primaryCategory) {
      return NextResponse.json(
        { error: "Article has no categories" },
        { status: 400 }
      );
    }
    
    // Generate content using AI service
    console.log('Generating content with AI...');
    
    const result = await aiService.generateArticleContent(
      article.articleTitle,
      primaryCategory.categoryName,
      userId
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
      primaryCategory.categoryName,
      existingTags,
      userId
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
        categories: {
          include: {
            category: true
          }
        },
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
        categories: {
          include: {
            category: true
          }
        },
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