import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { userId } = await getAuth(req);
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const { userId } = await getAuth(req);
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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