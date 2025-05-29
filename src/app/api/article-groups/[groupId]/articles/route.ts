import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { userId } = await getAuth(req);
  const { groupId } = await params;
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { articleId } = await req.json();

    if (!articleId || typeof articleId !== "string") {
      return NextResponse.json(
        { error: "Invalid article ID" },
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

    const article = await prisma.article.findUnique({
      where: { articleId },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    const groupArticle = await prisma.articleGroupArticle.create({
      data: {
        groupId,
        articleId,
      },
    });

    return NextResponse.json(groupArticle);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Article already in group" },
        { status: 409 }
      );
    }
    
    console.error("Error adding article to group:", error);
    return NextResponse.json(
      { error: "Failed to add article to group" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { userId } = await getAuth(req);
  const { groupId } = await params;
  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("articleId");
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!articleId) {
    return NextResponse.json(
      { error: "Article ID required" },
      { status: 400 }
    );
  }

  try {
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

    await prisma.articleGroupArticle.deleteMany({
      where: {
        groupId,
        articleId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing article from group:", error);
    return NextResponse.json(
      { error: "Failed to remove article from group" },
      { status: 500 }
    );
  }
}