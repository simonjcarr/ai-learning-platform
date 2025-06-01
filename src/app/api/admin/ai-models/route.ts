import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { aiService } from "@/lib/ai-service";

export async function GET() {
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

    const models = await aiService.getActiveModels();

    return NextResponse.json(models);
  } catch (error) {
    console.error("Error fetching AI models:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI models" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
    const {
      modelName,
      provider,
      displayName,
      description,
      apiKey,
      inputTokenCostPer1M,
      outputTokenCostPer1M,
      isDefault
    } = body;

    // Validate required fields
    if (!modelName || !provider || !displayName || !apiKey || 
        inputTokenCostPer1M === undefined || outputTokenCostPer1M === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.aIModel.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const model = await aiService.createModel({
      modelName,
      provider,
      displayName,
      description,
      apiKey,
      inputTokenCostPer1M: parseFloat(inputTokenCostPer1M),
      outputTokenCostPer1M: parseFloat(outputTokenCostPer1M),
      isDefault: isDefault || false
    });

    return NextResponse.json(model);
  } catch (error) {
    console.error("Error creating AI model:", error);
    return NextResponse.json(
      { error: "Failed to create AI model" },
      { status: 500 }
    );
  }
}