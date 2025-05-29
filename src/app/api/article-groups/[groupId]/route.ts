import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { userId } = await getAuth(req);
  const { groupId } = await params;
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const group = await prisma.articleGroup.findFirst({
      where: {
        groupId,
        clerkUserId: userId,
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Group not found" },
        { status: 404 }
      );
    }

    await prisma.articleGroup.delete({
      where: { groupId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting article group:", error);
    return NextResponse.json(
      { error: "Failed to delete article group" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { userId } = await getAuth(req);
  const { groupId } = await params;
  
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

    const group = await prisma.articleGroup.findFirst({
      where: {
        groupId,
        clerkUserId: userId,
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Group not found" },
        { status: 404 }
      );
    }

    const updatedGroup = await prisma.articleGroup.update({
      where: { groupId },
      data: { name },
    });

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error("Error updating article group:", error);
    return NextResponse.json(
      { error: "Failed to update article group" },
      { status: 500 }
    );
  }
}