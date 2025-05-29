import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; articleId: string }> }
) {
  const { userId } = await getAuth(req);
  const { groupId, articleId } = await params;
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { scrollPosition } = await req.json();

    if (typeof scrollPosition !== "number" || scrollPosition < 0) {
      return NextResponse.json(
        { error: "Invalid scroll position" },
        { status: 400 }
      );
    }

    const group = await prisma.articleGroup.findFirst({
      where: {
        groupId,
        clerkUserId: userId,
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Group not found" },
        { status: 404 }
      );
    }

    const groupArticle = await prisma.articleGroupArticle.updateMany({
      where: {
        groupId,
        articleId,
      },
      data: {
        scrollPosition,
        lastViewedAt: new Date(),
      },
    });

    if (groupArticle.count === 0) {
      return NextResponse.json(
        { error: "Article not found in group" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating scroll position:", error);
    return NextResponse.json(
      { error: "Failed to update scroll position" },
      { status: 500 }
    );
  }
}