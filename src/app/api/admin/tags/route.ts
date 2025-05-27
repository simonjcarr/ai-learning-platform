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

    const tag = await prisma.tag.create({
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
    console.error('Error creating tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}