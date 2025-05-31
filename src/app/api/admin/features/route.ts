import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role, FeatureCategory, FeatureType } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await requireMinRole(Role.ADMIN);
    
    const features = await prisma.feature.findMany({
      orderBy: [
        { category: "asc" },
        { featureName: "asc" }
      ],
    });
    
    return NextResponse.json({ features });
  } catch (error) {
    console.error("Error fetching features:", error);
    return NextResponse.json(
      { error: "Failed to fetch features" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireMinRole(Role.ADMIN);
    
    const body = await request.json();
    const { featureKey, featureName, description, category, featureType, defaultValue, metadata, isActive } = body;
    
    // Validate required fields
    if (!featureKey || !featureKey.trim()) {
      return NextResponse.json(
        { error: "Feature key is required" },
        { status: 400 }
      );
    }
    
    if (!featureName || !featureName.trim()) {
      return NextResponse.json(
        { error: "Feature name is required" },
        { status: 400 }
      );
    }
    
    if (!category || !Object.values(FeatureCategory).includes(category)) {
      return NextResponse.json(
        { error: "Valid feature category is required" },
        { status: 400 }
      );
    }
    
    if (!featureType || !Object.values(FeatureType).includes(featureType)) {
      return NextResponse.json(
        { error: "Valid feature type is required" },
        { status: 400 }
      );
    }
    
    // Check if feature key already exists
    const existingFeature = await prisma.feature.findUnique({
      where: { featureKey },
    });
    
    if (existingFeature) {
      return NextResponse.json(
        { error: `Feature with key '${featureKey}' already exists. Feature keys must be unique.` },
        { status: 400 }
      );
    }
    
    const feature = await prisma.feature.create({
      data: {
        featureKey,
        featureName,
        description: description || null,
        category,
        featureType,
        defaultValue: defaultValue || null,
        metadata: metadata || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });
    
    return NextResponse.json({ feature });
  } catch (error) {
    console.error("Error creating feature:", error);
    return NextResponse.json(
      { error: "Failed to create feature" },
      { status: 500 }
    );
  }
}