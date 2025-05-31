import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireMinRole(Role.ADMIN);
    
    const url = new URL(request.url);
    const pricingTierId = url.searchParams.get('pricingTierId');
    const featureId = url.searchParams.get('featureId');
    
    let whereClause: any = {};
    if (pricingTierId) whereClause.pricingTierId = pricingTierId;
    if (featureId) whereClause.featureId = featureId;
    
    const assignments = await prisma.pricingTierFeature.findMany({
      where: whereClause,
      include: {
        pricingTier: true,
        feature: true,
      },
      orderBy: [
        { pricingTier: { displayOrder: 'asc' } },
        { feature: { category: 'asc' } },
        { feature: { featureName: 'asc' } }
      ],
    });
    
    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("Error fetching pricing tier features:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing tier features" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireMinRole(Role.ADMIN);
    
    const body = await request.json();
    const { pricingTierId, featureId, isEnabled, limitValue, configValue } = body;
    
    // Validate required fields
    if (!pricingTierId) {
      return NextResponse.json(
        { error: "Pricing tier ID is required" },
        { status: 400 }
      );
    }
    
    if (!featureId) {
      return NextResponse.json(
        { error: "Feature ID is required" },
        { status: 400 }
      );
    }
    
    // Check if pricing tier exists
    const pricingTier = await prisma.subscriptionPricing.findUnique({
      where: { pricingId: pricingTierId },
    });
    
    if (!pricingTier) {
      return NextResponse.json(
        { error: "Pricing tier not found" },
        { status: 404 }
      );
    }
    
    // Check if feature exists
    const feature = await prisma.feature.findUnique({
      where: { featureId },
    });
    
    if (!feature) {
      return NextResponse.json(
        { error: "Feature not found" },
        { status: 404 }
      );
    }
    
    // Check if assignment already exists
    const existingAssignment = await prisma.pricingTierFeature.findUnique({
      where: {
        pricingTierId_featureId: {
          pricingTierId,
          featureId,
        },
      },
    });
    
    if (existingAssignment) {
      return NextResponse.json(
        { error: `Feature '${feature.featureName}' is already assigned to pricing tier '${pricingTier.tier}'.` },
        { status: 400 }
      );
    }
    
    const assignment = await prisma.pricingTierFeature.create({
      data: {
        pricingTierId,
        featureId,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        limitValue: limitValue || null,
        configValue: configValue || null,
      },
      include: {
        pricingTier: true,
        feature: true,
      },
    });
    
    return NextResponse.json({ assignment });
  } catch (error) {
    console.error("Error creating pricing tier feature assignment:", error);
    return NextResponse.json(
      { error: "Failed to create assignment" },
      { status: 500 }
    );
  }
}