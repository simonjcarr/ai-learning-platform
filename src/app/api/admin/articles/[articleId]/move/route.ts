import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { Role } from '@prisma/client';

export async function PATCH(
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

    if (!user || (user.role !== Role.ADMIN && user.role !== Role.EDITOR)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { categoryId } = await request.json();

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Remove all existing categories for this article
    await prisma.articleCategory.deleteMany({
      where: { articleId },
    });

    // Add the new category
    await prisma.articleCategory.create({
      data: {
        articleId,
        categoryId,
        isPrimary: true,
      },
    });

    // Fetch updated article with categories
    const article = await prisma.article.findUnique({
      where: { articleId },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    return NextResponse.json(article);
  } catch (error) {
    console.error('Error moving article:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}