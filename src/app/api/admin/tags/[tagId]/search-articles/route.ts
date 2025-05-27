import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// GET /api/admin/tags/[tagId]/search-articles
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  try {
    const { tagId } = await params;
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get article IDs that already have this tag
    const articlesWithTag = await prisma.articleTag.findMany({
      where: { tagId },
      select: { articleId: true }
    });

    const excludedArticleIds = articlesWithTag.map(at => at.articleId);

    // Search for articles that don't have this tag
    const articles = await prisma.article.findMany({
      where: {
        AND: [
          {
            articleId: {
              notIn: excludedArticleIds
            }
          },
          search ? {
            OR: [
              {
                articleTitle: {
                  contains: search,
                  mode: 'insensitive'
                }
              },
              {
                category: {
                  categoryName: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              }
            ]
          } : {}
        ]
      },
      select: {
        articleId: true,
        articleTitle: true,
        articleSlug: true,
        createdAt: true,
        isContentGenerated: true,
        category: {
          select: {
            categoryName: true
          }
        },
        _count: {
          select: {
            likes: true,
            comments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit results
    });

    // Transform data to match frontend expectations
    const transformedArticles = articles.map(article => ({
      id: article.articleId,
      title: article.articleTitle,
      slug: article.articleSlug,
      createdAt: article.createdAt,
      isContentGenerated: article.isContentGenerated,
      category: article.category,
      _count: article._count
    }));

    return NextResponse.json(transformedArticles);
  } catch (error) {
    console.error('Error searching articles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}