import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId } = await params;

    // Get all lists that contain this article for the current user
    const listsWithArticle = await prisma.curatedList.findMany({
      where: {
        clerkUserId: userId,
        items: {
          some: {
            articleId
          }
        }
      },
      select: {
        listId: true
      }
    });

    return NextResponse.json({
      listIds: listsWithArticle.map(list => list.listId)
    });
  } catch (error) {
    console.error("[ARTICLE_LISTS_GET]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}