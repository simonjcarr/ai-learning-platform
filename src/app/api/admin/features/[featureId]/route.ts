import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role, FeatureCategory, FeatureType } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    await requireMinRole(Role.ADMIN);
    const { featureId } = await params;
    
    const feature = await prisma.feature.findUnique({
      where: { featureId },
      include: {
        pricingTierFeatures: {
          include: {
            pricingTier: true,
          },
        },
      },
    });
    
    if (!feature) {
      return NextResponse.json(
        { error: "Feature not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ feature });
  } catch (error) {
    console.error("Error fetching feature:", error);
    return NextResponse.json(
      { error: "Failed to fetch feature" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    await requireMinRole(Role.ADMIN);
    const { featureId } = await params;
    
    const body = await request.json();
    const { featureKey, featureName, description, category, featureType, defaultValue, metadata, isActive } = body;
    
    // Check if feature exists
    const existingFeature = await prisma.feature.findUnique({
      where: { featureId },
    });
    
    if (!existingFeature) {
      return NextResponse.json(
        { error: "Feature not found" },
        { status: 404 }
      );
    }
    
    // If featureKey is being changed, check for conflicts
    if (featureKey && featureKey !== existingFeature.featureKey) {
      const conflictingFeature = await prisma.feature.findUnique({
        where: { featureKey },
      });
      
      if (conflictingFeature) {
        return NextResponse.json(
          { error: `Feature with key '${featureKey}' already exists. Feature keys must be unique.` },
          { status: 400 }
        );
      }
    }
    
    // Validate category if provided
    if (category && !Object.values(FeatureCategory).includes(category)) {
      return NextResponse.json(
        { error: "Valid feature category is required" },
        { status: 400 }
      );
    }
    
    // Validate featureType if provided
    if (featureType && !Object.values(FeatureType).includes(featureType)) {
      return NextResponse.json(
        { error: "Valid feature type is required" },
        { status: 400 }
      );
    }
    
    const updateData: any = {};
    if (featureKey !== undefined) updateData.featureKey = featureKey;
    if (featureName !== undefined) updateData.featureName = featureName;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (featureType !== undefined) updateData.featureType = featureType;
    if (defaultValue !== undefined) updateData.defaultValue = defaultValue;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const feature = await prisma.feature.update({
      where: { featureId },
      data: updateData,
    });
    
    return NextResponse.json({ feature });
  } catch (error) {
    console.error("Error updating feature:", error);
    return NextResponse.json(
      { error: "Failed to update feature" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    await requireMinRole(Role.ADMIN);
    const { featureId } = await params;
    
    // Check if feature exists
    const feature = await prisma.feature.findUnique({
      where: { featureId },
      include: {
        pricingTierFeatures: true,
      },
    });
    
    if (!feature) {
      return NextResponse.json(
        { error: "Feature not found" },
        { status: 404 }
      );
    }
    
    // Check if feature is assigned to any pricing tiers
    if (feature.pricingTierFeatures.length > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete feature. It is currently assigned to ${feature.pricingTierFeatures.length} pricing tier(s).`,
          assignedTiers: feature.pricingTierFeatures.length,
          suggestion: "Remove this feature from all pricing tiers before deleting, or deactivate it instead."
        },
        { status: 400 }
      );
    }
    
    await prisma.feature.delete({
      where: { featureId },
    });
    
    return NextResponse.json({ 
      message: `Feature '${feature.featureName}' deleted successfully.`
    });
  } catch (error) {
    console.error("Error deleting feature:", error);
    return NextResponse.json(
      { error: "Failed to delete feature" },
      { status: 500 }
    );
  }
}