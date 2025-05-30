import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { articleId } = await params;
    await requireMinRole(Role.MODERATOR);
    
    const body = await request.json();
    const { action } = body;
    
    if (action === "approve") {
      // Remove flag
      await prisma.article.update({
        where: { articleId },
        data: {
          isFlagged: false,
          flaggedAt: null,
          flaggedByClerkUserId: null,
          flagReason: null,
        },
      });
    } else if (action === "remove") {
      // Delete the article
      await prisma.article.delete({
        where: { articleId },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resolving flagged article:", error);
    return NextResponse.json(
      { error: "Failed to resolve flagged article" },
      { status: 500 }
    );
  }
}