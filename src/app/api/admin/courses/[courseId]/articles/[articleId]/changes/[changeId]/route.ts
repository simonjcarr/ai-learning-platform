import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; articleId: string; changeId: string }> }
) {
  try {
    await requireMinRole(Role.EDITOR);
    
    const { courseId, articleId, changeId } = await params;
    
    const change = await prisma.courseArticleChangeHistory.findUnique({
      where: { id: changeId },
      include: {
        article: {
          include: {
            section: {
              include: {
                course: {
                  select: {
                    courseId: true,
                    title: true,
                  }
                }
              }
            }
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        rollbackUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      },
    });
    
    if (!change) {
      return NextResponse.json(
        { error: "Change history not found" },
        { status: 404 }
      );
    }
    
    // Verify the change belongs to the requested article and course
    if (change.articleId !== articleId || change.article.section.course.courseId !== courseId) {
      return NextResponse.json(
        { error: "Change history not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(change);
  } catch (error) {
    console.error("Error fetching change history:", error);
    return NextResponse.json(
      { error: "Failed to fetch change history" },
      { status: 500 }
    );
  }
}