import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; articleId: string }> }
) {
  try {
    await requireMinRole(Role.EDITOR);
    
    const { courseId, articleId } = await params;
    
    // Verify the article belongs to the course
    const article = await prisma.courseArticle.findUnique({
      where: { articleId },
      include: {
        section: {
          include: {
            course: {
              select: { courseId: true }
            }
          }
        }
      }
    });
    
    if (!article || article.section.course.courseId !== courseId) {
      return NextResponse.json(
        { error: "Course article not found" },
        { status: 404 }
      );
    }
    
    // Fetch all changes for this article
    const changes = await prisma.courseArticleChangeHistory.findMany({
      where: { articleId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json(changes);
  } catch (error) {
    console.error("Error fetching change histories:", error);
    return NextResponse.json(
      { error: "Failed to fetch change histories" },
      { status: 500 }
    );
  }
}