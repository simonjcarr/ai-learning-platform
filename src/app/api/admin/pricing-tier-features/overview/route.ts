import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await requireMinRole(Role.ADMIN);
    
    // Get all pricing tiers with their feature assignments
    const pricingTiers = await prisma.subscriptionPricing.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        featureAssignments: {
          include: {
            feature: {
              include: {
                category: true
              }
            }
          },
          orderBy: [
            { feature: { category: { displayOrder: 'asc' } } },
            { feature: { featureName: 'asc' } }
          ],
        },
      },
    });
    
    // Get all features for the matrix view
    const allFeatures = await prisma.feature.findMany({
      where: { isActive: true },
      include: {
        category: true
      },
      orderBy: [
        { category: { displayOrder: 'asc' } },
        { featureName: 'asc' }
      ],
    });
    
    // Create a feature matrix for easy viewing
    const featureMatrix = allFeatures.map(feature => {
      const tierAssignments: Record<string, any> = {};
      
      pricingTiers.forEach(tier => {
        const assignment = tier.featureAssignments.find(
          assignment => assignment.featureId === feature.featureId
        );
        
        tierAssignments[tier.tier] = assignment ? {
          id: assignment.id,
          isEnabled: assignment.isEnabled,
          limitValue: assignment.limitValue,
          configValue: assignment.configValue,
        } : null;
      });
      
      return {
        feature,
        tierAssignments,
      };
    });
    
    // Create a summary for each tier
    const tierSummaries = pricingTiers.map(tier => ({
      tier: tier.tier,
      pricingId: tier.pricingId,
      displayOrder: tier.displayOrder,
      isActive: tier.isActive,
      monthlyPriceCents: tier.monthlyPriceCents,
      yearlyPriceCents: tier.yearlyPriceCents,
      enabledFeatures: tier.featureAssignments.filter(assignment => assignment.isEnabled).length,
      totalFeatures: tier.featureAssignments.length,
      featuresByCategory: tier.featureAssignments.reduce((acc, assignment) => {
        if (assignment.isEnabled) {
          const categoryKey = assignment.feature.category.categoryKey;
          acc[categoryKey] = (acc[categoryKey] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
    }));
    
    return NextResponse.json({
      pricingTiers,
      allFeatures,
      featureMatrix,
      tierSummaries,
    });
  } catch (error) {
    console.error("Error fetching pricing tier features overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch overview" },
      { status: 500 }
    );
  }
}