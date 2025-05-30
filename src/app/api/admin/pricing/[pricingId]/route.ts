import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { 
  createOrUpdateStripeProduct, 
  createOrUpdateStripePrice, 
  getActiveSubscriptionsForPrice,
  archiveStripePrice 
} from "@/lib/stripe";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { pricingId: string } }
) {
  try {
    await requireMinRole(Role.ADMIN);
    
    const body = await request.json();
    const currentPricing = await prisma.subscriptionPricing.findUnique({
      where: { pricingId: params.pricingId },
    });

    if (!currentPricing) {
      return NextResponse.json(
        { error: "Pricing not found" },
        { status: 404 }
      );
    }

    // Validate tier name if provided
    if (body.tier !== undefined && (!body.tier || !body.tier.trim())) {
      return NextResponse.json(
        { error: "Tier name cannot be empty" },
        { status: 400 }
      );
    }

    // Check if tier is being changed and if the new tier already exists
    if (body.tier && body.tier !== currentPricing.tier) {
      const existingTier = await prisma.subscriptionPricing.findUnique({
        where: { tier: body.tier },
      });
      
      if (existingTier) {
        return NextResponse.json(
          { error: `Tier ${body.tier} already exists. Each tier must be unique.` },
          { status: 400 }
        );
      }
    }

    // If features, tier, or pricing changed, update Stripe
    if (body.features || body.tier || body.monthlyPriceCents || body.freeTrialDays !== undefined) {
      const features = body.features || currentPricing.features;
      const tier = body.tier || currentPricing.tier;
      const monthlyPriceCents = body.monthlyPriceCents || currentPricing.monthlyPriceCents;
      const freeTrialDays = body.freeTrialDays !== undefined ? body.freeTrialDays : currentPricing.freeTrialDays;

      // Update or create Stripe product if features or tier changed
      let stripeProductId = currentPricing.stripeProductId;
      if (body.features || body.tier) {
        stripeProductId = await createOrUpdateStripeProduct(tier, features);
        if (stripeProductId !== currentPricing.stripeProductId) {
          body.stripeProductId = stripeProductId;
        }
      }

      // Create new Stripe price if price, trial period, or tier changed
      if (body.monthlyPriceCents || body.freeTrialDays !== undefined || body.tier) {
        if (stripeProductId) {
          const newStripePriceId = await createOrUpdateStripePrice(
            stripeProductId,
            monthlyPriceCents,
            'month',
            freeTrialDays
          );
          
          // Archive old price
          if (currentPricing.stripePriceId) {
            await archiveStripePrice(currentPricing.stripePriceId);
          }
          
          body.stripePriceId = newStripePriceId;
        }
      }
    }
    
    const pricing = await prisma.subscriptionPricing.update({
      where: { pricingId: params.pricingId },
      data: body,
    });
    
    return NextResponse.json({ pricing });
  } catch (error) {
    console.error("Error updating pricing:", error);
    return NextResponse.json(
      { error: "Failed to update pricing" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { pricingId: string } }
) {
  try {
    await requireMinRole(Role.ADMIN);
    
    const pricing = await prisma.subscriptionPricing.findUnique({
      where: { pricingId: params.pricingId },
    });

    if (!pricing) {
      return NextResponse.json(
        { error: "Pricing not found" },
        { status: 404 }
      );
    }

    // Check for active subscriptions
    if (pricing.stripePriceId) {
      const activeSubscriptions = await getActiveSubscriptionsForPrice(pricing.stripePriceId);
      if (activeSubscriptions > 0) {
        return NextResponse.json(
          { 
            error: "Cannot delete pricing tier with active subscriptions",
            activeSubscriptions,
            suggestion: "Consider disabling the tier instead"
          },
          { status: 400 }
        );
      }
    }
    
    // Archive in Stripe before deleting
    if (pricing.stripePriceId) {
      await archiveStripePrice(pricing.stripePriceId);
    }

    await prisma.subscriptionPricing.delete({
      where: { pricingId: params.pricingId },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pricing:", error);
    return NextResponse.json(
      { error: "Failed to delete pricing" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { pricingId: string } }
) {
  try {
    await requireMinRole(Role.ADMIN);
    
    const body = await request.json();
    const { action } = body;

    if (action === 'disable') {
      const pricing = await prisma.subscriptionPricing.findUnique({
        where: { pricingId: params.pricingId },
      });

      if (!pricing) {
        return NextResponse.json(
          { error: "Pricing not found" },
          { status: 404 }
        );
      }

      // Archive the price in Stripe
      if (pricing.stripePriceId) {
        await archiveStripePrice(pricing.stripePriceId);
      }

      // Disable in database
      const updatedPricing = await prisma.subscriptionPricing.update({
        where: { pricingId: params.pricingId },
        data: { isActive: false },
      });

      return NextResponse.json({ 
        pricing: updatedPricing,
        message: "Pricing tier disabled. Active subscriptions will continue until they naturally expire or are cancelled by customers."
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error performing action on pricing:", error);
    return NextResponse.json(
      { error: "Failed to perform action" },
      { status: 500 }
    );
  }
}