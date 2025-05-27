import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

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

    const interactionTypes = await prisma.aIInteractionType.findMany({
      include: {
        defaultModel: {
          select: {
            modelId: true,
            displayName: true,
            provider: true,
            isActive: true
          }
        }
      },
      orderBy: { displayName: 'asc' }
    });

    return NextResponse.json(interactionTypes);
  } catch (error) {
    console.error("Error fetching AI interaction types:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI interaction types" },
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
    const { typeName, displayName, description, defaultModelId } = body;

    // Validate required fields
    if (!typeName || !displayName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const interactionType = await prisma.aIInteractionType.create({
      data: {
        typeName,
        displayName,
        description,
        defaultModelId
      },
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
    console.error("Error creating AI interaction type:", error);
    return NextResponse.json(
      { error: "Failed to create AI interaction type" },
      { status: 500 }
    );
  }
}