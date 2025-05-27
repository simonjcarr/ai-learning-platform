import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// GET /api/admin/articles/[articleId]/tags
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { articleId } = await params;
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || ![Role.ADMIN, Role.EDITOR].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const articleTags = await prisma.articleTag.findMany({
      where: { articleId },
      include: {
        tag: true
      }
    });

    return NextResponse.json(articleTags.map(at => at.tag));
  } catch (error) {
    console.error('Error fetching article tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/articles/[articleId]/tags
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { articleId } = await params;
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || ![Role.ADMIN, Role.EDITOR].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tagIds } = await request.json();

    if (!Array.isArray(tagIds)) {
      return NextResponse.json({ error: 'tagIds must be an array' }, { status: 400 });
    }

    // Remove all existing tags for this article
    await prisma.articleTag.deleteMany({
      where: { articleId }
    });

    // Add new tags
    if (tagIds.length > 0) {
      await prisma.articleTag.createMany({
        data: tagIds.map((tagId: string) => ({
          articleId,
          tagId
        }))
      });
    }

    // Return updated tags
    const updatedTags = await prisma.articleTag.findMany({
      where: { articleId },
      include: {
        tag: true
      }
    });

    return NextResponse.json(updatedTags.map(at => at.tag));
  } catch (error) {
    console.error('Error updating article tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}