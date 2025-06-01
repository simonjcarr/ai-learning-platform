import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role, FeatureType } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await requireMinRole(Role.ADMIN);
    
    const features = await prisma.feature.findMany({
      include: {
        category: true
      },
      orderBy: [
        { category: { displayOrder: "asc" } },
        { featureName: "asc" }
      ],
    });
    
    // Also fetch feature categories for dropdowns
    const featureCategories = await prisma.featureCategory.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" }
    });
    
    return NextResponse.json({ features, featureCategories });
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
    const { featureKey, featureName, description, categoryId, featureType, defaultValue, metadata, isActive } = body;
    
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
    
    if (!categoryId || !categoryId.trim()) {
      return NextResponse.json(
        { error: "Feature category is required" },
        { status: 400 }
      );
    }
    
    // Validate that the category exists
    const categoryExists = await prisma.featureCategory.findUnique({
      where: { categoryId }
    });
    
    if (!categoryExists) {
      return NextResponse.json(
        { error: "Invalid feature category" },
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
        categoryId,
        featureType,
        defaultValue: defaultValue || null,
        metadata: metadata || null,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        category: true
      }
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