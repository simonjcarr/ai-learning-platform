import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// GET /api/admin/tags
export async function GET(request: NextRequest) {
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
    const search = searchParams.get('search') || '';

    const tags = await prisma.tag.findMany({
      where: search ? {
        tagName: {
          contains: search,
          mode: 'insensitive'
        }
      } : {},
      include: {
        _count: {
          select: {
            articles: true
          }
        }
      },
      orderBy: { tagName: 'asc' }
    });

    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Array of diverse, professional colors for tags
const tagColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#D2B4DE', '#AED6F1',
  '#A9DFBF', '#F9E79F', '#FADBD8', '#D5DBDB', '#FF9F43', '#6C5CE7', '#00B894', '#E17055',
  '#0984e3', '#6c5ce7', '#a29bfe', '#fd79a8', '#fdcb6e', '#e84393',
];

function getRandomTagColor(): string {
  return tagColors[Math.floor(Math.random() * tagColors.length)];
}

// POST /api/admin/tags
export async function POST(request: NextRequest) {
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

    const { tagName, description, color } = await request.json();

    if (!tagName || !tagName.trim()) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    // If no color is provided, assign a random one
    const finalColor = color?.trim() || getRandomTagColor();

    const tag = await prisma.tag.create({
      data: {
        tagName: tagName.trim(),
        description: description?.trim() || null,
        color: finalColor,
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
    console.error('Error creating tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}