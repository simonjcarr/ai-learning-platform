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
    
    const courseArticle = await prisma.courseArticle.findUnique({
      where: { articleId },
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
      },
    });
    
    if (!courseArticle) {
      return NextResponse.json(
        { error: "Course article not found" },
        { status: 404 }
      );
    }
    
    // Verify the article belongs to the requested course
    if (courseArticle.section.course.courseId !== courseId) {
      return NextResponse.json(
        { error: "Article does not belong to this course" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(courseArticle);
  } catch (error) {
    console.error("Error fetching course article:", error);
    return NextResponse.json(
      { error: "Failed to fetch course article" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; articleId: string }> }
) {
  try {
    await requireMinRole(Role.EDITOR);
    
    const { courseId, articleId } = await params;
    const body = await request.json();
    const { title, description, contentHtml } = body;
    
    // Verify the article belongs to the requested course
    const existingArticle = await prisma.courseArticle.findUnique({
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
    
    if (!existingArticle || existingArticle.section.course.courseId !== courseId) {
      return NextResponse.json(
        { error: "Course article not found" },
        { status: 404 }
      );
    }
    
    const updatedArticle = await prisma.courseArticle.update({
      where: { articleId },
      data: {
        title,
        description,
        contentHtml,
        isGenerated: contentHtml ? true : false,
        generatedAt: contentHtml && !existingArticle.generatedAt ? new Date() : existingArticle.generatedAt,
      },
    });
    
    return NextResponse.json({ success: true, article: updatedArticle });
  } catch (error) {
    console.error("Error updating course article:", error);
    return NextResponse.json(
      { error: "Failed to update course article" },
      { status: 500 }
    );
  }
}