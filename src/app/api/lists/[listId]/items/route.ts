import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: { listId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { articleId, notes } = body;

    if (!articleId) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { status: 400 }
      );
    }

    // Check if user owns the list
    const list = await prisma.curatedList.findFirst({
      where: {
        listId: params.listId,
        clerkUserId: userId,
      },
    });

    if (!list) {
      return NextResponse.json(
        { error: 'List not found or unauthorized' },
        { status: 404 }
      );
    }

    // Check if article exists
    const article = await prisma.article.findUnique({
      where: { articleId },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Check if article is already in the list
    const existingItem = await prisma.curatedListItem.findUnique({
      where: {
        listId_articleId: {
          listId: params.listId,
          articleId,
        },
      },
    });

    if (existingItem) {
      return NextResponse.json(
        { error: 'Article already in list' },
        { status: 400 }
      );
    }

    // Get the highest order value
    const maxOrderItem = await prisma.curatedListItem.findFirst({
      where: { listId: params.listId },
      orderBy: { order: 'desc' },
    });

    const newOrder = maxOrderItem ? maxOrderItem.order + 1 : 0;

    const item = await prisma.curatedListItem.create({
      data: {
        listId: params.listId,
        articleId,
        order: newOrder,
        notes,
      },
      include: {
        article: true,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error adding item to list:', error);
    return NextResponse.json(
      { error: 'Failed to add item to list' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { listId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('articleId');

    if (!articleId) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { status: 400 }
      );
    }

    // Check if user owns the list
    const list = await prisma.curatedList.findFirst({
      where: {
        listId: params.listId,
        clerkUserId: userId,
      },
    });

    if (!list) {
      return NextResponse.json(
        { error: 'List not found or unauthorized' },
        { status: 404 }
      );
    }

    await prisma.curatedListItem.delete({
      where: {
        listId_articleId: {
          listId: params.listId,
          articleId,
        },
      },
    });

    return NextResponse.json({ message: 'Item removed from list' });
  } catch (error) {
    console.error('Error removing item from list:', error);
    return NextResponse.json(
      { error: 'Failed to remove item from list' },
      { status: 500 }
    );
  }
}