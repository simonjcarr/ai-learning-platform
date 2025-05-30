import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createOrUpdateStripeProduct, createOrUpdateStripePrice } from "@/lib/stripe";

export async function GET() {
  try {
    await requireMinRole(Role.ADMIN);
    
    const pricing = await prisma.subscriptionPricing.findMany({
      orderBy: { tier: "asc" },
    });
    
    return NextResponse.json({ pricing });
  } catch (error) {
    console.error("Error fetching pricing:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireMinRole(Role.ADMIN);
    
    const body = await request.json();
    const { tier, monthlyPriceCents, yearlyPriceCents, features, isActive, freeTrialDays } = body;
    
    // Validate tier name
    if (!tier || !tier.trim()) {
      return NextResponse.json(
        { error: "Tier name is required" },
        { status: 400 }
      );
    }
    
    // Check if tier already exists
    const existingTier = await prisma.subscriptionPricing.findUnique({
      where: { tier },
    });
    
    if (existingTier) {
      return NextResponse.json(
        { error: `Tier ${tier} already exists. Each tier must be unique.` },
        { status: 400 }
      );
    }
    
    // Create or update Stripe product
    const stripeProductId = await createOrUpdateStripeProduct(tier, features);
    
    // Create Stripe price for monthly billing
    const stripePriceId = await createOrUpdateStripePrice(
      stripeProductId,
      monthlyPriceCents,
      'month',
      freeTrialDays || 0
    );
    
    const pricing = await prisma.subscriptionPricing.create({
      data: {
        tier,
        stripePriceId,
        stripeProductId,
        monthlyPriceCents,
        yearlyPriceCents,
        features,
        isActive,
        freeTrialDays: freeTrialDays || 0,
      },
    });
    
    return NextResponse.json({ pricing });
  } catch (error) {
    console.error("Error creating pricing:", error);
    return NextResponse.json(
      { error: "Failed to create pricing" },
      { status: 500 }
    );
  }
}