import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const excludeCategory = searchParams.get('excludeCategory');

    if (!query.trim()) {
      return NextResponse.json([]);
    }

    // Search for articles
    const articles = await prisma.article.findMany({
      where: {
        AND: [
          {
            OR: [
              { articleTitle: { contains: query, mode: 'insensitive' } },
              { articleSlug: { contains: query, mode: 'insensitive' } },
            ],
          },
          excludeCategory ? { categoryId: { not: excludeCategory } } : {},
        ],
      },
      select: {
        articleId: true,
        articleTitle: true,
        articleSlug: true,
        createdAt: true,
        category: {
          select: {
            categoryId: true,
            categoryName: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform the data to match frontend expectations
    const transformedArticles = articles.map(article => ({
      id: article.articleId,
      title: article.articleTitle,
      slug: article.articleSlug,
      createdAt: article.createdAt,
      viewCount: 0, // Default to 0 since viewCount is not tracked
      category: {
        id: article.category.categoryId,
        categoryName: article.category.categoryName,
      },
      _count: article._count,
    }));

    return NextResponse.json(transformedArticles);
  } catch (error) {
    console.error('Error searching articles:', error);
    return NextResponse.json(
      { error: 'Failed to search articles' },
      { status: 500 }
    );
  }
}