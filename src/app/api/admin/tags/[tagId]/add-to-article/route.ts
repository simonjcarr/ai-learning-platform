import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// POST /api/admin/tags/[tagId]/add-to-article
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  try {
    const { tagId } = await params;
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

    const { articleId } = await request.json();

    if (!articleId) {
      return NextResponse.json({ error: 'Article ID is required' }, { status: 400 });
    }

    // Check if tag exists
    const tag = await prisma.tag.findUnique({
      where: { tagId }
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Check if article exists
    const article = await prisma.article.findUnique({
      where: { articleId }
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Create the article-tag relationship (ignore if already exists)
    try {
      await prisma.articleTag.create({
        data: {
          articleId,
          tagId
        }
      });
    } catch (error) {
      // If it already exists, that's fine
      if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        return NextResponse.json({ 
          message: 'Tag already assigned to this article',
          success: true 
        });
      }
      throw error;
    }

    return NextResponse.json({ 
      message: 'Tag successfully added to article',
      success: true 
    });
  } catch (error) {
    console.error('Error adding tag to article:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}