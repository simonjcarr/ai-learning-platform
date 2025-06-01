import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    await requireMinRole(Role.ADMIN);
    const { categoryId } = await params;
    
    const category = await prisma.featureCategory.findUnique({
      where: { categoryId },
      include: {
        features: {
          select: {
            featureId: true,
            featureKey: true,
            featureName: true,
            isActive: true
          }
        },
        _count: {
          select: { features: true }
        }
      },
    });
    
    if (!category) {
      return NextResponse.json(
        { error: "Feature category not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error fetching feature category:", error);
    return NextResponse.json(
      { error: "Failed to fetch feature category" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    await requireMinRole(Role.ADMIN);
    const { categoryId } = await params;
    
    const body = await request.json();
    const { categoryKey, categoryName, description, displayOrder, isActive } = body;
    
    // Check if category exists
    const existingCategory = await prisma.featureCategory.findUnique({
      where: { categoryId },
    });
    
    if (!existingCategory) {
      return NextResponse.json(
        { error: "Feature category not found" },
        { status: 404 }
      );
    }
    
    // If categoryKey is being changed, check for conflicts
    if (categoryKey && categoryKey !== existingCategory.categoryKey) {
      const conflictingCategory = await prisma.featureCategory.findUnique({
        where: { categoryKey },
      });
      
      if (conflictingCategory) {
        return NextResponse.json(
          { error: `Category with key '${categoryKey}' already exists. Category keys must be unique.` },
          { status: 400 }
        );
      }
    }
    
    const updateData: any = {};
    if (categoryKey !== undefined) updateData.categoryKey = categoryKey;
    if (categoryName !== undefined) updateData.categoryName = categoryName;
    if (description !== undefined) updateData.description = description;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const category = await prisma.featureCategory.update({
      where: { categoryId },
      data: updateData,
    });
    
    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error updating feature category:", error);
    return NextResponse.json(
      { error: "Failed to update feature category" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    await requireMinRole(Role.ADMIN);
    const { categoryId } = await params;
    
    // Check if category exists
    const category = await prisma.featureCategory.findUnique({
      where: { categoryId },
      include: {
        features: true,
      },
    });
    
    if (!category) {
      return NextResponse.json(
        { error: "Feature category not found" },
        { status: 404 }
      );
    }
    
    // Check if category has any features
    if (category.features.length > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete category. It contains ${category.features.length} feature(s).`,
          featureCount: category.features.length,
          suggestion: "Move all features to another category before deleting, or deactivate this category instead."
        },
        { status: 400 }
      );
    }
    
    await prisma.featureCategory.delete({
      where: { categoryId },
    });
    
    return NextResponse.json({ 
      message: `Feature category '${category.categoryName}' deleted successfully.`
    });
  } catch (error) {
    console.error("Error deleting feature category:", error);
    return NextResponse.json(
      { error: "Failed to delete feature category" },
      { status: 500 }
    );
  }
}