import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ articleId: string }> }
) {
  try {
    const { userId } = await auth();
    const { articleId } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if article exists
    const article = await prisma.article.findUnique({
      where: { articleId }
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // For now, we'll track article views through user responses to interactive examples
    // This is a simple implementation - in a production app you might want a separate 
    // article_views table to track views independently of quiz responses

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Article view tracking error:", error);
    return NextResponse.json(
      { error: "Failed to track article view" },
      { status: 500 }
    );
  }
}