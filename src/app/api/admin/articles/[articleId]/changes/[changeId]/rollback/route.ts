import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { hasRole } from '@/lib/auth';
import { createPatch } from 'diff';

export async function POST(
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
    
    const isAdmin = hasRole(user.role, ['ADMIN']);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Await params in Next.js 15
    const { articleId, changeId } = await params;

    // Get the change to rollback
    const changeToRollback = await prisma.articleChangeHistory.findUnique({
      where: { 
        id: changeId,
        articleId: articleId,
      },
      include: {
        article: true,
      },
    });

    if (!changeToRollback) {
      return NextResponse.json({ error: 'Change not found' }, { status: 404 });
    }

    if (!changeToRollback.isActive) {
      return NextResponse.json({ error: 'Change is already rolled back' }, { status: 400 });
    }

    // Start a transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get the current article content
      const currentArticle = await tx.article.findUnique({
        where: { articleId },
        select: { contentHtml: true },
      });

      if (!currentArticle) {
        throw new Error('Article not found');
      }

      // Create a rollback diff
      const rollbackDiff = createPatch(
        changeToRollback.article.articleTitle,
        currentArticle.contentHtml || '',
        changeToRollback.beforeContent,
        'current',
        'rollback'
      );

      // Create a dummy suggestion record for the rollback
      const rollbackSuggestion = await tx.articleSuggestion.create({
        data: {
          articleId: articleId,
          clerkUserId: userId,
          suggestionType: 'OTHER',
          suggestionDetails: `Rollback of change: ${changeToRollback.description}`,
          isApproved: true,
          isApplied: true,
          processedAt: new Date(),
          appliedAt: new Date(),
        },
      });

      // Create a new change history entry for the rollback
      const rollbackChange = await tx.articleChangeHistory.create({
        data: {
          articleId: articleId,
          suggestionId: rollbackSuggestion.suggestionId,
          clerkUserId: userId,
          diff: rollbackDiff,
          beforeContent: currentArticle.contentHtml || '',
          afterContent: changeToRollback.beforeContent,
          changeType: 'rollback',
          description: `Rolled back change: ${changeToRollback.description}`,
          isActive: true,
        },
      });

      // Mark the original change as rolled back
      await tx.articleChangeHistory.update({
        where: { id: changeId },
        data: {
          isActive: false,
          rolledBackAt: new Date(),
          rolledBackBy: userId,
        },
      });

      // Update the article content
      await tx.article.update({
        where: { articleId },
        data: {
          contentHtml: changeToRollback.beforeContent,
        },
      });

      // If this was from a suggestion, update the suggestion status
      if (changeToRollback.suggestionId) {
        await tx.articleSuggestion.update({
          where: { suggestionId: changeToRollback.suggestionId },
          data: {
            isApplied: false,
          },
        });
      }

      return rollbackChange;
    });

    return NextResponse.json({
      success: true,
      rollbackChange: result,
      message: 'Change successfully rolled back',
    });
  } catch (error) {
    console.error('Error rolling back change:', error);
    return NextResponse.json(
      { error: 'Failed to rollback change' },
      { status: 500 }
    );
  }
}