import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { addSitemapToQueue } from "@/lib/bullmq";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    await requireMinRole(Role.EDITOR);
    
    const { articleId } = await params;
    
    const article = await prisma.article.findUnique({
      where: { articleId },
      include: {
        category: true,
        stream: true,
      },
    });
    
    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(article);
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json(
      { error: "Failed to fetch article" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    await requireMinRole(Role.EDITOR);
    
    const { articleId } = await params;
    const body = await request.json();
    const { 
      articleTitle, 
      articleSlug, 
      contentHtml, 
      categoryId,
      // SEO fields
      seoTitle,
      seoDescription,
      seoKeywords,
      seoCanonicalUrl,
      seoImageUrl,
      seoImageAlt,
      seoChangeFreq,
      seoPriority,
      seoNoIndex,
      seoNoFollow,
      seoLastModified
    } = body;
    
    // Check if slug is already taken by another article
    if (articleSlug) {
      const existingArticle = await prisma.article.findFirst({
        where: {
          articleSlug,
          NOT: { articleId },
        },
      });
      
      if (existingArticle) {
        return NextResponse.json(
          { error: "Slug is already in use" },
          { status: 400 }
        );
      }
    }
    
    console.log('📝 Updating article with SEO data:', articleId);
    
    const article = await prisma.article.update({
      where: { articleId },
      data: {
        articleTitle,
        articleSlug,
        contentHtml,
        categoryId,
        isContentGenerated: contentHtml ? true : false,
        // SEO fields
        seoTitle,
        seoDescription,
        seoKeywords,
        seoCanonicalUrl,
        seoImageUrl,
        seoImageAlt,
        seoChangeFreq,
        seoPriority,
        seoNoIndex,
        seoNoFollow,
        seoLastModified: seoLastModified || new Date(),
      },
    });
    
    // Trigger sitemap regeneration when articles are updated
    try {
      console.log('🗺️ Triggering sitemap regeneration after article update:', articleId);
      const job = await addSitemapToQueue({
        type: 'regenerate',
        triggerBy: 'admin_article_update',
        articleId: articleId,
      });
      console.log('🗺️ Sitemap job queued:', job ? job.id : 'null (job was skipped)');
    } catch (sitemapError) {
      console.error('❌ Failed to queue sitemap regeneration:', sitemapError);
      // Don't fail the main request if sitemap queueing fails
    }
    
    return NextResponse.json({ success: true, article });
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json(
      { error: "Failed to update article" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    await requireMinRole(Role.EDITOR);
    
    const { articleId } = await params;
    
    console.log('🗑️ Deleting article:', articleId);
    
    const article = await prisma.article.delete({
      where: { articleId },
    });
    
    // Trigger sitemap regeneration when articles are deleted
    try {
      console.log('🗺️ Triggering sitemap regeneration after article deletion:', articleId);
      const job = await addSitemapToQueue({
        type: 'regenerate',
        triggerBy: 'admin_article_delete',
        articleId: articleId,
      });
      console.log('🗺️ Sitemap job queued:', job ? job.id : 'null (job was skipped)');
    } catch (sitemapError) {
      console.error('❌ Failed to queue sitemap regeneration:', sitemapError);
      // Don't fail the main request if sitemap queueing fails
    }
    
    return NextResponse.json({ success: true, article });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json(
      { error: "Failed to delete article" },
      { status: 500 }
    );
  }
}