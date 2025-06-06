import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { aiService } from "@/lib/ai-service";
import { checkFeatureAccessWithAdmin, checkFeatureUsageWithAdmin } from "@/lib/feature-access-admin";
import { addSitemapToQueue } from "@/lib/bullmq";

export async function GET(
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
    const contentAccess = await checkFeatureAccessWithAdmin('generate_article_content', userId);
    
    if (!contentAccess.hasAccess) {
      return NextResponse.json(
        { error: contentAccess.reason || "Subscription required to generate article content" },
        { status: 403 }
      );
    }

    // Check usage limits (admins have unlimited access)
    const usageCheck = await checkFeatureUsageWithAdmin('daily_article_generation_limit', userId, 'daily');
    
    if (!usageCheck.hasAccess) {
      return NextResponse.json(
        { 
          error: usageCheck.reason || `Daily generation limit reached (${usageCheck.currentUsage}/${usageCheck.limit}). Upgrade for more generations.`,
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

    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let isClosed = false;
        
        // Helper function to send data with error handling
        const sendData = (data: any) => {
          if (isClosed) return;
          
          try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          } catch (error) {
            console.error('Failed to send streaming data (controller may be closed):', error);
            isClosed = true;
            // Don't throw here to avoid breaking the generation process
          }
        };

        try {
          // Send initial status
          sendData({ 
            type: 'status', 
            message: 'Starting article generation...',
            progress: 0
          });

          // Generate content using AI service with streaming
          sendData({ 
            type: 'status', 
            message: 'Generating content with AI...',
            progress: 10
          });

          // Generate the content with streaming callbacks
          const result = await aiService.generateArticleContentWithStreaming(
            article.articleTitle,
            primaryCategory.categoryName,
            userId,
            (progress: string, percentage: number) => {
              sendData({ 
                type: 'progress', 
                message: progress,
                progress: percentage
              });
            },
            (chunk: string, fullContent: string) => {
              // Send content chunks as they arrive
              sendData({ 
                type: 'content_chunk', 
                chunk: chunk,
                content: fullContent,
                message: 'Streaming content...'
              });
            }
          );

          sendData({ 
            type: 'content_complete', 
            message: 'Content generation complete',
            progress: 95,
            content: result.content
          });

          // Small delay to ensure content_complete event is processed
          await new Promise(resolve => setTimeout(resolve, 100));

          // Process in background: tags, SEO, and database updates
          // Await this to get the final article with all data
          const finalData = await processBackgroundUpdates(article, result, primaryCategory, userId, sendData);

          // Send the final completion with the complete article data
          sendData({ 
            type: 'complete', 
            message: 'Generation completed successfully!',
            progress: 100,
            article: finalData.article,
            tagsCreated: finalData.tagsCreated,
            tagsAssigned: finalData.tagsAssigned
          });

          // Close the stream
          try {
            controller.close();
            isClosed = true;
          } catch (error) {
            console.error('Error closing controller:', error);
            isClosed = true;
          }
        } catch (error) {
          console.error("Error generating content:", error);
          sendData({ 
            type: 'error', 
            message: error instanceof Error ? error.message : "Failed to generate content"
          });
          try {
            controller.close();
            isClosed = true;
          } catch (closeError) {
            console.error('Error closing controller after error:', closeError);
            isClosed = true;
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("Error in streaming generation:", error);
    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 }
    );
  }
}

// Background processing function
async function processBackgroundUpdates(
  article: any,
  result: any,
  primaryCategory: any,
  userId: string,
  sendData: (data: any) => void
): Promise<any> {
  try {
    // Get existing tags for AI selection
    sendData({ 
      type: 'status', 
      message: 'Processing tags...',
      progress: 70
    });

    const existingTags = await prisma.tag.findMany({
      select: {
        tagId: true,
        tagName: true,
        description: true
      },
      orderBy: { tagName: 'asc' }
    });

    // Generate tag suggestions using AI
    const tagSelection = await aiService.selectAndCreateTags(
      article.articleTitle,
      primaryCategory.categoryName,
      existingTags,
      userId
    );

    sendData({ 
      type: 'status', 
      message: 'Creating new tags...',
      progress: 80
    });

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

    sendData({ 
      type: 'status', 
      message: 'Saving to database...',
      progress: 90
    });

    // Collect all tag IDs to assign to the article
    const allTagIds = [
      ...tagSelection.existing_tags, // Selected existing tag IDs
      ...createdTags.map(tag => tag.tagId) // New tag IDs
    ];

    // Update the article with generated content, SEO data, and tags
    const updatedArticle = await prisma.article.update({
      where: { articleId: article.articleId },
      data: {
        contentHtml: result.content,
        isContentGenerated: true,
        updatedAt: new Date(),
        // Add SEO data from AI generation
        seoTitle: result.seo?.seoTitle,
        seoDescription: result.seo?.seoDescription,
        seoKeywords: result.seo?.seoKeywords || [],
        seoCanonicalUrl: result.seo?.seoCanonicalUrl,
        seoImageAlt: result.seo?.seoImageAlt,
        seoLastModified: result.seo?.seoLastModified || new Date(),
        seoChangeFreq: result.seo?.seoChangeFreq || 'WEEKLY',
        seoPriority: result.seo?.seoPriority || 0.7,
        seoNoIndex: result.seo?.seoNoIndex || false,
        seoNoFollow: result.seo?.seoNoFollow || false,
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

    // Trigger sitemap regeneration
    try {
      const job = await addSitemapToQueue({
        type: 'regenerate',
        triggerBy: 'article_generation',
        articleId: article.articleId,
      });
      console.log('🗺️ Sitemap job queued:', job ? job.id : 'null (job was skipped)');
    } catch (sitemapError) {
      console.error('❌ Failed to queue sitemap regeneration:', sitemapError);
    }

    // Fetch the final article with all tags and relationships
    const finalArticle = await prisma.article.findUnique({
      where: { articleId: article.articleId },
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

    return {
      article: finalArticle,
      tagsCreated: createdTags.length,
      tagsAssigned: allTagIds.length
    };

  } catch (error) {
    console.error("Error in background processing:", error);
    sendData({ 
      type: 'error', 
      message: 'Failed to complete background processing'
    });
    throw error;
  }
}