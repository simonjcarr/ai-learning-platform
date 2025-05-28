import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { hasRole } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and check admin role
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const isAdmin = hasRole(user.role, ['ADMIN', 'MODERATOR']);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Await params in Next.js 15
    const { articleId } = await params;

    // Get search params
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = { articleId };
    if (!includeInactive) {
      where.isActive = true;
    }

    // Get changes with pagination
    const [changes, total] = await Promise.all([
      prisma.articleChangeHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              clerkUserId: true,
              email: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
            },
          },
          suggestion: {
            select: {
              suggestionId: true,
              suggestionType: true,
              suggestionDetails: true,
              isApproved: true,
              processedAt: true,
            },
          },
          rollbackUser: {
            select: {
              clerkUserId: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.articleChangeHistory.count({ where }),
    ]);

    return NextResponse.json({
      changes,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching article changes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article changes' },
      { status: 500 }
    );
  }
}