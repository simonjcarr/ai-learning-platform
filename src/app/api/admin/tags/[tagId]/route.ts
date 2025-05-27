import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { use } from 'react';

// GET /api/admin/tags/[tagId]
export async function GET(
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

    const tag = await prisma.tag.findUnique({
      where: { tagId },
      include: {
        _count: {
          select: {
            articles: true
          }
        }
      }
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json(tag);
  } catch (error) {
    console.error('Error fetching tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/tags/[tagId]
export async function PUT(
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

    const { tagName, description, color } = await request.json();

    if (!tagName || !tagName.trim()) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    const tag = await prisma.tag.update({
      where: { tagId },
      data: {
        tagName: tagName.trim(),
        description: description?.trim() || null,
        color: color?.trim() || null,
      },
      include: {
        _count: {
          select: {
            articles: true
          }
        }
      }
    });

    return NextResponse.json(tag);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint failed')) {
      return NextResponse.json({ error: 'Tag name already exists' }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }
    console.error('Error updating tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/tags/[tagId]
export async function DELETE(
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

    // Check if tag exists and get article count
    const tag = await prisma.tag.findUnique({
      where: { tagId },
      include: {
        _count: {
          select: {
            articles: true
          }
        }
      }
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Delete the tag (this will cascade and delete ArticleTag entries)
    await prisma.tag.delete({
      where: { tagId }
    });

    return NextResponse.json({ 
      message: 'Tag deleted successfully',
      articlesAffected: tag._count.articles
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }
    console.error('Error deleting tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}