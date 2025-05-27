import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { articleId: string } }
) {
  try {
    await requireMinRole(Role.EDITOR);
    
    const article = await prisma.article.delete({
      where: { articleId: params.articleId },
    });
    
    return NextResponse.json({ success: true, article });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json(
      { error: "Failed to delete article" },
      { status: 500 }
    );
  }
}