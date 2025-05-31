import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    await requireMinRole(Role.ADMIN);
    const { assignmentId } = await params;
    
    const assignment = await prisma.pricingTierFeature.findUnique({
      where: { id: assignmentId },
      include: {
        pricingTier: true,
        feature: true,
      },
    });
    
    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ assignment });
  } catch (error) {
    console.error("Error fetching assignment:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignment" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    await requireMinRole(Role.ADMIN);
    const { assignmentId } = await params;
    
    const body = await request.json();
    const { isEnabled, limitValue, configValue } = body;
    
    // Check if assignment exists
    const existingAssignment = await prisma.pricingTierFeature.findUnique({
      where: { id: assignmentId },
      include: {
        pricingTier: true,
        feature: true,
      },
    });
    
    if (!existingAssignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }
    
    const updateData: any = {};
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
    if (limitValue !== undefined) updateData.limitValue = limitValue;
    if (configValue !== undefined) updateData.configValue = configValue;
    
    const assignment = await prisma.pricingTierFeature.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        pricingTier: true,
        feature: true,
      },
    });
    
    return NextResponse.json({ assignment });
  } catch (error) {
    console.error("Error updating assignment:", error);
    return NextResponse.json(
      { error: "Failed to update assignment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    await requireMinRole(Role.ADMIN);
    const { assignmentId } = await params;
    
    // Check if assignment exists
    const assignment = await prisma.pricingTierFeature.findUnique({
      where: { id: assignmentId },
      include: {
        pricingTier: true,
        feature: true,
      },
    });
    
    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }
    
    await prisma.pricingTierFeature.delete({
      where: { id: assignmentId },
    });
    
    return NextResponse.json({ 
      message: `Removed feature '${assignment.feature.featureName}' from pricing tier '${assignment.pricingTier.tier}'.`
    });
  } catch (error) {
    console.error("Error deleting assignment:", error);
    return NextResponse.json(
      { error: "Failed to delete assignment" },
      { status: 500 }
    );
  }
}