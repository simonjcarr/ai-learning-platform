import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; articleId: string; changeId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireMinRole(Role.EDITOR);
    
    const { courseId, articleId, changeId } = await params;
    
    // Get the change to rollback
    const change = await prisma.courseArticleChangeHistory.findUnique({
      where: { id: changeId },
      include: {
        article: {
          include: {
            section: {
              include: {
                course: {
                  select: { courseId: true }
                }
              }
            }
          }
        }
      }
    });
    
    if (!change) {
      return NextResponse.json(
        { error: "Change history not found" },
        { status: 404 }
      );
    }
    
    // Verify the change belongs to the requested article and course
    if (change.articleId !== articleId || change.article.section.course.courseId !== courseId) {
      return NextResponse.json(
        { error: "Change history not found" },
        { status: 404 }
      );
    }
    
    if (!change.isActive) {
      return NextResponse.json(
        { error: "This change has already been rolled back" },
        { status: 400 }
      );
    }
    
    // Perform the rollback in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the article content to the before state
      await tx.courseArticle.update({
        where: { articleId },
        data: {
          contentHtml: change.beforeContent,
        },
      });
      
      // Mark the change as rolled back
      const updatedChange = await tx.courseArticleChangeHistory.update({
        where: { id: changeId },
        data: {
          isActive: false,
          rolledBackAt: new Date(),
          rolledBackBy: userId,
        },
      });
      
      // Create a new change history for the rollback
      const rollbackChange = await tx.courseArticleChangeHistory.create({
        data: {
          articleId,
          clerkUserId: userId,
          diff: `Rolled back change: ${change.description}`,
          beforeContent: change.afterContent,
          afterContent: change.beforeContent,
          changeType: 'rollback',
          description: `Rolled back: "${change.description}"`,
          isActive: true,
        },
      });
      
      return { updatedChange, rollbackChange };
    });
    
    return NextResponse.json({ 
      success: true, 
      message: "Change has been rolled back successfully",
      rollbackChangeId: result.rollbackChange.id
    });
  } catch (error) {
    console.error("Error rolling back change:", error);
    return NextResponse.json(
      { error: "Failed to rollback change" },
      { status: 500 }
    );
  }
}