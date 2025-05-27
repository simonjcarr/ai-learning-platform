import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { articleId: string } }
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

    const article = await prisma.article.update({
      where: { articleId: params.articleId },
      data: {
        isFlagged: true,
        flaggedAt: new Date(),
        flaggedByClerkUserId: authUser.clerkUserId,
        flagReason: flagReason.trim(),
      },
    });

    return NextResponse.json({ success: true, article });
  } catch (error) {
    console.error("Error flagging article:", error);
    return NextResponse.json(
      { error: "Failed to flag article" },
      { status: 500 }
    );
  }
}