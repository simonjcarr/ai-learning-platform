import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireMinRole(Role.EDITOR);
    
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 20;
    const search = searchParams.get("search") || "";
    const filter = searchParams.get("filter") || "all";
    
    const where: any = {};
    
    if (search) {
      where.OR = [
        { articleTitle: { contains: search, mode: "insensitive" } },
        { articleSlug: { contains: search, mode: "insensitive" } },
      ];
    }
    
    if (filter === "flagged") {
      where.isFlagged = true;
    } else if (filter === "generated") {
      where.isContentGenerated = true;
    }
    
    const [articles, totalCount] = await Promise.all([
      prisma.article.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: {
            select: { categoryName: true },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.article.count({ where }),
    ]);
    
    return NextResponse.json({
      articles,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      totalCount,
    });
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}