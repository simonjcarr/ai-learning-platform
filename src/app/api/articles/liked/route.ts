import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure user exists in database
    await prisma.user.upsert({
      where: { clerkUserId: userId },
      update: {
        lastLoginToApp: new Date(),
      },
      create: {
        clerkUserId: userId,
        email: 'temp@example.com', // Will be updated by webhook
      },
    });

    const likedArticles = await prisma.articleLike.findMany({
      where: { clerkUserId: userId },
      include: {
        article: {
          include: {
            categories: {
              include: {
                category: true
              }
            },
            _count: {
              select: {
                comments: true,
                likes: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const articles = likedArticles.map(like => ({
      ...like.article,
      likedAt: like.createdAt,
    }));

    return NextResponse.json(articles);
  } catch (error) {
    console.error('Error fetching liked articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch liked articles' },
      { status: 500 }
    );
  }
}