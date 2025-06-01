import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { aiService } from "@/lib/ai-service";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ modelId: string }> }
) {
  const { modelId } = await params;
  
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
    if (body.inputTokenCostPer1M !== undefined) updateData.inputTokenCostPer1M = parseFloat(body.inputTokenCostPer1M);
    if (body.outputTokenCostPer1M !== undefined) updateData.outputTokenCostPer1M = parseFloat(body.outputTokenCostPer1M);
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
    if (body.apiKey !== undefined) updateData.apiKey = body.apiKey; // Will be encrypted in aiService

    // If setting as default, unset other defaults
    if (body.isDefault) {
      await prisma.aIModel.updateMany({
        where: { 
          modelId: { not: modelId },
          isDefault: true 
        },
        data: { isDefault: false }
      });
    }

    const model = await aiService.updateModel(modelId, updateData);

    return NextResponse.json(model);
  } catch (error) {
    console.error("Error updating AI model:", error);
    return NextResponse.json(
      { error: "Failed to update AI model" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ modelId: string }> }
) {
  const { modelId } = await params;
  
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

    // Check if this model is being used by any interaction types
    const usageCount = await prisma.aIInteractionType.count({
      where: { defaultModelId: modelId }
    });

    if (usageCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete model that is assigned to interaction types" },
        { status: 400 }
      );
    }

    await aiService.deleteModel(modelId);

    return NextResponse.json({ message: "Model deleted successfully" });
  } catch (error) {
    console.error("Error deleting AI model:", error);
    return NextResponse.json(
      { error: "Failed to delete AI model" },
      { status: 500 }
    );
  }
}