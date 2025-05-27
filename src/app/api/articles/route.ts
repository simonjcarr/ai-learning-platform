import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const isContentGenerated = searchParams.get('isContentGenerated');

    const where: any = {};
    
    if (categoryId) {
      where.categories = {
        some: {
          categoryId: categoryId
        }
      };
    }
    
    if (isContentGenerated !== null) {
      where.isContentGenerated = isContentGenerated === 'true';
    }

    const articles = await prisma.article.findMany({
      where,
      include: {
        categories: {
          include: {
            category: true
          }
        },
        createdBy: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    const userId = user?.id;
    const body = await request.json();
    const { categoryIds, primaryCategoryId, articleTitle, contentHtml } = body;

    if (!categoryIds || categoryIds.length === 0 || !articleTitle) {
      return NextResponse.json(
        { error: "At least one category ID and article title are required" },
        { status: 400 }
      );
    }

    const articleSlug = slugify(articleTitle);

    const existingArticle = await prisma.article.findUnique({
      where: { articleSlug }
    });

    if (existingArticle) {
      return NextResponse.json(
        { error: "Article with this title already exists" },
        { status: 409 }
      );
    }

    const article = await prisma.article.create({
      data: {
        articleTitle,
        articleSlug,
        contentHtml,
        isContentGenerated: !!contentHtml,
        createdByClerkUserId: userId || null,
      }
    });
    
    // Create article-category relationships
    for (const categoryId of categoryIds) {
      await prisma.articleCategory.create({
        data: {
          articleId: article.articleId,
          categoryId: categoryId,
          isPrimary: categoryId === (primaryCategoryId || categoryIds[0])
        }
      });
    }
    
    // Fetch complete article with categories
    const completeArticle = await prisma.article.findUnique({
      where: { articleId: article.articleId },
      include: {
        categories: {
          include: {
            category: true
          }
        },
        createdBy: true,
      }
    });

    return NextResponse.json(completeArticle, { status: 201 });
  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json(
      { error: "Failed to create article" },
      { status: 500 }
    );
  }
}