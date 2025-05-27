import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireMinRole(Role.MODERATOR);
    
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "all";
    
    const items: any[] = [];
    
    if (type === "all" || type === "articles") {
      const flaggedArticles = await prisma.article.findMany({
        where: { isFlagged: true },
        include: {
          createdBy: {
            select: { username: true, email: true },
          },
          flaggedBy: {
            select: { username: true, email: true },
          },
        },
        orderBy: { flaggedAt: "desc" },
      });
      
      items.push(...flaggedArticles.map(article => ({
        id: article.articleId,
        type: "article" as const,
        content: article.contentHtml?.substring(0, 300) || "",
        title: article.articleTitle,
        flaggedAt: article.flaggedAt,
        flagReason: article.flagReason,
        flaggedBy: article.flaggedBy || { username: null, email: "Unknown" },
        author: article.createdBy || { username: null, email: "Unknown" },
      })));
    }
    
    if (type === "all" || type === "comments") {
      const flaggedComments = await prisma.comment.findMany({
        where: { isFlagged: true },
        include: {
          user: {
            select: { username: true, email: true },
          },
          flaggedBy: {
            select: { username: true, email: true },
          },
          article: {
            select: {
              articleId: true,
              articleTitle: true,
              articleSlug: true,
            },
          },
        },
        orderBy: { flaggedAt: "desc" },
      });
      
      items.push(...flaggedComments.map(comment => ({
        id: comment.commentId,
        type: "comment" as const,
        content: comment.content,
        flaggedAt: comment.flaggedAt,
        flagReason: comment.flagReason,
        flaggedBy: comment.flaggedBy || { username: null, email: "Unknown" },
        author: comment.user,
        articleInfo: comment.article,
      })));
    }
    
    // Sort by flaggedAt date
    items.sort((a, b) => {
      const dateA = a.flaggedAt ? new Date(a.flaggedAt).getTime() : 0;
      const dateB = b.flaggedAt ? new Date(b.flaggedAt).getTime() : 0;
      return dateB - dateA;
    });
    
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching flagged content:", error);
    return NextResponse.json(
      { error: "Failed to fetch flagged content" },
      { status: 500 }
    );
  }
}