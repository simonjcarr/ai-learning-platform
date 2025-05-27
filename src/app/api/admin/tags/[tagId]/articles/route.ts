import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// GET /api/admin/tags/[tagId]/articles
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

    // Get the tag
    const tag = await prisma.tag.findUnique({
      where: { tagId }
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Get articles with this tag
    const articleTags = await prisma.articleTag.findMany({
      where: { tagId },
      include: {
        article: {
          select: {
            articleId: true,
            articleTitle: true,
            articleSlug: true,
            createdAt: true,
            isContentGenerated: true,
            category: {
              select: {
                categoryName: true
              }
            },
            _count: {
              select: {
                likes: true,
                comments: true
              }
            }
          }
        }
      },
      orderBy: {
        article: {
          createdAt: 'desc'
        }
      }
    });

    const articles = articleTags.map(at => ({
      id: at.article.articleId,
      title: at.article.articleTitle,
      slug: at.article.articleSlug,
      createdAt: at.article.createdAt,
      isContentGenerated: at.article.isContentGenerated,
      category: at.article.category,
      _count: at.article._count
    }));

    return NextResponse.json({
      tag,
      articles
    });
  } catch (error) {
    console.error('Error fetching tag articles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}