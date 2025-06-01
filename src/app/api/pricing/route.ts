import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // Get all active pricing tiers
    const pricing = await prisma.subscriptionPricing.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        featureAssignments: {
          where: {
            isEnabled: true,
            feature: { isActive: true }
          },
          include: {
            feature: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    // Get all active features for the feature matrix
    const allFeatures = await prisma.feature.findMany({
      where: { isActive: true },
      include: {
        category: true
      },
      orderBy: [
        { category: { displayOrder: "asc" } },
        { featureName: "asc" }
      ]
    });

    // Transform the data to include feature assignments
    const pricingWithFeatures = pricing.map(tier => ({
      pricingId: tier.pricingId,
      tier: tier.tier,
      stripePriceId: tier.stripePriceId,
      monthlyPriceCents: tier.monthlyPriceCents,
      yearlyPriceCents: tier.yearlyPriceCents,
      isActive: tier.isActive,
      freeTrialDays: tier.freeTrialDays,
      displayOrder: tier.displayOrder,
      featureAssignments: tier.featureAssignments.map(assignment => ({
        featureKey: assignment.feature.featureKey,
        featureName: assignment.feature.featureName,
        featureType: assignment.feature.featureType,
        category: {
          categoryKey: assignment.feature.category.categoryKey,
          categoryName: assignment.feature.category.categoryName
        },
        isEnabled: assignment.isEnabled,
        limitValue: assignment.limitValue,
        configValue: assignment.configValue
      }))
    }));
    
    return NextResponse.json({ 
      pricing: pricingWithFeatures,
      allFeatures: allFeatures.map(feature => ({
        featureId: feature.featureId,
        featureKey: feature.featureKey,
        featureName: feature.featureName,
        description: feature.description,
        category: {
          categoryKey: feature.category.categoryKey,
          categoryName: feature.category.categoryName
        },
        featureType: feature.featureType
      }))
    });
  } catch (error) {
    console.error("Error fetching public pricing:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing" },
      { status: 500 }
    );
  }
}