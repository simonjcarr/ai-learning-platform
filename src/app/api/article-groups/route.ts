import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { checkFeatureAccessWithAdmin } from "@/lib/feature-access-admin";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check feature access (admins bypass all restrictions)
  const groupAccess = await checkFeatureAccessWithAdmin('article_groups', userId);
  
  if (!groupAccess.hasAccess) {
    return NextResponse.json(
      { error: groupAccess.reason || 'Subscription required to use article groups' },
      { status: 403 }
    );
  }

  try {
    const groups = await prisma.articleGroup.findMany({
      where: { clerkUserId: userId },
      include: {
        articles: {
          include: {
            article: {
              select: {
                articleId: true,
                articleTitle: true,
                articleSlug: true,
              },
            },
          },
          orderBy: { lastViewedAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error("Error fetching article groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch article groups" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check feature access (admins bypass all restrictions)
  const groupAccess = await checkFeatureAccessWithAdmin('article_groups', userId);
  
  if (!groupAccess.hasAccess) {
    return NextResponse.json(
      { error: groupAccess.reason || 'Subscription required to use article groups' },
      { status: 403 }
    );
  }

  try {
    const { name } = await req.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Invalid group name" },
        { status: 400 }
      );
    }

    const group = await prisma.articleGroup.create({
      data: {
        name,
        clerkUserId: userId,
      },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error("Error creating article group:", error);
    return NextResponse.json(
      { error: "Failed to create article group" },
      { status: 500 }
    );
  }
}