import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  try {
    const authUser = await requireAuth();
    const body = await request.json();
    const { flagReason } = body;

    if (!flagReason || !flagReason.trim()) {
      return NextResponse.json(
        { error: "Flag reason is required" },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.update({
      where: { commentId: params.commentId },
      data: {
        isFlagged: true,
        flaggedAt: new Date(),
        flaggedByClerkUserId: authUser.clerkUserId,
        flagReason: flagReason.trim(),
      },
    });

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error("Error flagging comment:", error);
    return NextResponse.json(
      { error: "Failed to flag comment" },
      { status: 500 }
    );
  }
}