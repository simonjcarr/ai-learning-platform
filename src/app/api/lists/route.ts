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

    const lists = await prisma.curatedList.findMany({
      where: { clerkUserId: userId },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(lists);
  } catch (error) {
    console.error('Error fetching lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lists' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { listName, description, isPublic = false } = body;

    if (!listName) {
      return NextResponse.json(
        { error: 'List name is required' },
        { status: 400 }
      );
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

    const list = await prisma.curatedList.create({
      data: {
        clerkUserId: userId,
        listName,
        description,
        isPublic,
      },
    });

    return NextResponse.json(list, { status: 201 });
  } catch (error) {
    console.error('Error creating list:', error);
    return NextResponse.json(
      { error: 'Failed to create list' },
      { status: 500 }
    );
  }
}