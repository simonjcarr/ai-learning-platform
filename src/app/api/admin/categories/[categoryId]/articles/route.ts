import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export async function GET(
  request: Request,
  props: { params: Promise<{ categoryId: string }> }
) {
  const params = await props.params;
  const { categoryId } = params;

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

    // Fetch articles in this category
    const articles = await prisma.article.findMany({
      where: {
        categoryId,
      },
      select: {
        articleId: true,
        articleTitle: true,
        articleSlug: true,
        createdAt: true,
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
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
      _count: article._count,
    }));

    return NextResponse.json(transformedArticles);
  } catch (error) {
    console.error('Error fetching category articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}