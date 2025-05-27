import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ typeId: string }> }
) {
  const { typeId } = await params;
  
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updateData: any = {};

    // Only update provided fields
    if (body.displayName !== undefined) updateData.displayName = body.displayName;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.defaultModelId !== undefined) updateData.defaultModelId = body.defaultModelId;

    const interactionType = await prisma.aIInteractionType.update({
      where: { typeId },
      data: updateData,
      include: {
        defaultModel: {
          select: {
            modelId: true,
            displayName: true,
            provider: true,
            isActive: true
          }
        }
      }
    });

    return NextResponse.json(interactionType);
  } catch (error) {
    console.error("Error updating AI interaction type:", error);
    return NextResponse.json(
      { error: "Failed to update AI interaction type" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ typeId: string }> }
) {
  const { typeId } = await params;
  
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Check if this interaction type has any interactions
    const usageCount = await prisma.aIInteraction.count({
      where: { interactionTypeId: typeId }
    });

    if (usageCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete interaction type with existing interactions" },
        { status: 400 }
      );
    }

    await prisma.aIInteractionType.delete({
      where: { typeId }
    });

    return NextResponse.json({ message: "Interaction type deleted successfully" });
  } catch (error) {
    console.error("Error deleting AI interaction type:", error);
    return NextResponse.json(
      { error: "Failed to delete AI interaction type" },
      { status: 500 }
    );
  }
}