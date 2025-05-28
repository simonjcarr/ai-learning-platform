import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    // Await params in Next.js 15
    const { articleId } = await params;

    // Get only active changes for public view
    const changes = await prisma.articleChangeHistory.findMany({
      where: { 
        articleId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        changeType: true,
        description: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
        suggestion: {
          select: {
            suggestionType: true,
          },
        },
      },
    });

    // Get article info
    const article = await prisma.article.findUnique({
      where: { articleId },
      select: {
        articleTitle: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json({
      article,
      changes,
      totalChanges: changes.length,
    });
  } catch (error) {
    console.error('Error fetching article change history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch change history' },
      { status: 500 }
    );
  }
}