import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  try {
    await requireMinRole(Role.MODERATOR);
    
    const body = await request.json();
    const { action } = body;
    
    if (action === "approve") {
      // Remove flag
      await prisma.comment.update({
        where: { commentId: params.commentId },
        data: {
          isFlagged: false,
          flaggedAt: null,
          flaggedByClerkUserId: null,
          flagReason: null,
        },
      });
    } else if (action === "remove") {
      // Delete the comment
      await prisma.comment.delete({
        where: { commentId: params.commentId },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resolving flagged comment:", error);
    return NextResponse.json(
      { error: "Failed to resolve flagged comment" },
      { status: 500 }
    );
  }
}