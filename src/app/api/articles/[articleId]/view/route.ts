import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkFeatureAccessWithAdmin } from "@/lib/feature-access-admin";

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

    // Check feature access for viewing articles (admins bypass all restrictions)
    const viewAccess = await checkFeatureAccessWithAdmin('view_articles', userId);
    
    if (!viewAccess.hasAccess) {
      return NextResponse.json(
        { error: viewAccess.reason || "Subscription required to view articles" },
        { status: 403 }
      );
    }

    // Check if article exists
    const article = await prisma.article.findUnique({
      where: { articleId }
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Ensure user exists in the database first
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId }
    });

    if (!user) {
      console.error(`User not found in database: ${userId}`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Upsert the article view - update viewedAt if user has already viewed this article
    const view = await prisma.userArticleView.upsert({
      where: {
        clerkUserId_articleId: {
          clerkUserId: userId,
          articleId: articleId
        }
      },
      update: {
        viewedAt: new Date()
      },
      create: {
        clerkUserId: userId,
        articleId: articleId
      }
    });

    console.log(`Article view tracked: User ${userId} viewed article ${articleId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Article view tracking error:", error);
    return NextResponse.json(
      { error: "Failed to track article view" },
      { status: 500 }
    );
  }
}