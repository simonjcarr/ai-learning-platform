import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { articleId: string } }
) {
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

    const like = await prisma.articleLike.findUnique({
      where: {
        articleId_clerkUserId: {
          articleId: params.articleId,
          clerkUserId: userId,
        },
      },
    });

    return NextResponse.json({ isLiked: !!like });
  } catch (error) {
    console.error('Error checking like status:', error);
    return NextResponse.json(
      { error: 'Failed to check like status' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { articleId: string } }
) {
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

    const { articleId } = params;

    // Check if article exists
    const article = await prisma.article.findUnique({
      where: { articleId },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Check if already liked
    const existingLike = await prisma.articleLike.findUnique({
      where: {
        articleId_clerkUserId: {
          articleId,
          clerkUserId: userId,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.articleLike.delete({
        where: { likeId: existingLike.likeId },
      });
      return NextResponse.json({ isLiked: false, message: 'Article unliked' });
    } else {
      // Like
      await prisma.articleLike.create({
        data: {
          articleId,
          clerkUserId: userId,
        },
      });
      return NextResponse.json({ isLiked: true, message: 'Article liked' });
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    );
  }
}