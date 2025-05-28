import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { hasRole } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string; changeId: string }> }
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
    const { changeId } = await params;

    // Get the specific change
    const change = await prisma.articleChangeHistory.findUnique({
      where: { id: changeId },
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
            processedAt: true,
            aiValidationResponse: true,
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
    });

    if (!change) {
      return NextResponse.json({ error: 'Change not found' }, { status: 404 });
    }

    return NextResponse.json(change);
  } catch (error) {
    console.error('Error fetching change details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch change details' },
      { status: 500 }
    );
  }
}