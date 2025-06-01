import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await requireMinRole(Role.ADMIN);
    
    const categories = await prisma.featureCategory.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        _count: {
          select: { features: true }
        }
      }
    });
    
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error fetching feature categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch feature categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireMinRole(Role.ADMIN);
    
    const body = await request.json();
    const { categoryKey, categoryName, description, displayOrder, isActive } = body;
    
    // Validate required fields
    if (!categoryKey || !categoryKey.trim()) {
      return NextResponse.json(
        { error: "Category key is required" },
        { status: 400 }
      );
    }
    
    if (!categoryName || !categoryName.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }
    
    // Check if category key already exists
    const existingCategory = await prisma.featureCategory.findUnique({
      where: { categoryKey },
    });
    
    if (existingCategory) {
      return NextResponse.json(
        { error: `Category with key '${categoryKey}' already exists. Category keys must be unique.` },
        { status: 400 }
      );
    }
    
    // If no display order provided, put it at the end
    let finalDisplayOrder = displayOrder;
    if (finalDisplayOrder === undefined || finalDisplayOrder === null) {
      const lastCategory = await prisma.featureCategory.findFirst({
        orderBy: { displayOrder: "desc" }
      });
      finalDisplayOrder = (lastCategory?.displayOrder || 0) + 1;
    }
    
    const category = await prisma.featureCategory.create({
      data: {
        categoryKey,
        categoryName,
        description: description || null,
        displayOrder: finalDisplayOrder,
        isActive: isActive !== undefined ? isActive : true,
      },
    });
    
    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error creating feature category:", error);
    return NextResponse.json(
      { error: "Failed to create feature category" },
      { status: 500 }
    );
  }
}