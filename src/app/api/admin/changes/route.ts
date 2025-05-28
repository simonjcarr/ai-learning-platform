import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { hasRole } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    console.log('Admin changes API - userId:', userId);
    
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
    console.log('Admin changes API - user role:', user.role, 'isAdmin:', isAdmin);
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get search params
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const changeType = searchParams.get('changeType');
    const userIdFilter = searchParams.get('userId');

    // Build where clause
    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    if (changeType) {
      where.changeType = changeType;
    }
    if (userIdFilter) {
      where.clerkUserId = userIdFilter;
    }

    console.log('Admin changes API - where clause:', where);
    console.log('Admin changes API - limit/offset:', limit, offset);

    // Get changes with pagination
    const [changes, total] = await Promise.all([
      prisma.articleChangeHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          article: {
            select: {
              articleId: true,
              articleTitle: true,
              articleSlug: true,
            },
          },
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

    console.log('Admin changes API - found changes:', changes.length, 'total:', total);

    // Get summary statistics
    const stats = await prisma.articleChangeHistory.groupBy({
      by: ['changeType'],
      _count: {
        id: true,
      },
      where: where.isActive !== undefined ? { isActive: where.isActive } : {},
    });

    return NextResponse.json({
      changes,
      stats: stats.reduce((acc, stat) => {
        acc[stat.changeType] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching changes:', error);
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      error: 'Failed to fetch changes',
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    };
    
    return NextResponse.json(errorDetails, { status: 500 });
  }
}