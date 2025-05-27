import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { listId } = await params;
    const list = await prisma.curatedList.findFirst({
      where: {
        listId: listId,
        OR: [
          { clerkUserId: userId },
          { isPublic: true },
        ],
      },
      include: {
        items: {
          include: {
            article: {
              include: {
                categories: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
        user: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    return NextResponse.json(list);
  } catch (error) {
    console.error('Error fetching list:', error);
    return NextResponse.json(
      { error: 'Failed to fetch list' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { listName, description, isPublic } = body;

    const { listId } = await params;
    const list = await prisma.curatedList.findFirst({
      where: {
        listId: listId,
        clerkUserId: userId,
      },
    });

    if (!list) {
      return NextResponse.json(
        { error: 'List not found or unauthorized' },
        { status: 404 }
      );
    }

    const updatedList = await prisma.curatedList.update({
      where: { listId: listId },
      data: {
        ...(listName !== undefined && { listName }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
      },
    });

    return NextResponse.json(updatedList);
  } catch (error) {
    console.error('Error updating list:', error);
    return NextResponse.json(
      { error: 'Failed to update list' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { listId } = await params;
    const list = await prisma.curatedList.findFirst({
      where: {
        listId: listId,
        clerkUserId: userId,
      },
    });

    if (!list) {
      return NextResponse.json(
        { error: 'List not found or unauthorized' },
        { status: 404 }
      );
    }

    await prisma.curatedList.delete({
      where: { listId: listId },
    });

    return NextResponse.json({ message: 'List deleted successfully' });
  } catch (error) {
    console.error('Error deleting list:', error);
    return NextResponse.json(
      { error: 'Failed to delete list' },
      { status: 500 }
    );
  }
}