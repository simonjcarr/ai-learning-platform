import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { articleId: string } }
) {
  try {
    const authUser = await requireMinRole(Role.EDITOR);
    const body = await request.json();
    const { isFlagged, flagReason } = body;
    
    const article = await prisma.article.update({
      where: { articleId: params.articleId },
      data: {
        isFlagged,
        flaggedAt: isFlagged ? new Date() : null,
        flaggedByClerkUserId: isFlagged ? authUser.clerkUserId : null,
        flagReason: isFlagged ? flagReason : null,
      },
    });
    
    return NextResponse.json({ success: true, article });
  } catch (error) {
    console.error("Error updating article flag:", error);
    return NextResponse.json(
      { error: "Failed to update article flag" },
      { status: 500 }
    );
  }
}