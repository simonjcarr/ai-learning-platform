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

    // If tier or pricing changed, update Stripe
    if (body.tier || body.monthlyPriceCents || body.freeTrialDays !== undefined) {
      const tier = body.tier || currentPricing.tier;
      const monthlyPriceCents = body.monthlyPriceCents || currentPricing.monthlyPriceCents;
      const freeTrialDays = body.freeTrialDays !== undefined ? body.freeTrialDays : currentPricing.freeTrialDays;

      console.log(`🔄 Updating pricing for tier "${tier}":`, {
        oldPrice: currentPricing.monthlyPriceCents,
        newPrice: monthlyPriceCents,
        oldPriceId: currentPricing.stripePriceId,
        oldTrialDays: currentPricing.freeTrialDays,
        newTrialDays: freeTrialDays
      });

      // Update or create Stripe product if tier changed
      let stripeProductId = currentPricing.stripeProductId;
      if (body.tier) {
        console.log(`📦 Updating Stripe product for tier change`);
        stripeProductId = await createOrUpdateStripeProduct(tier);
        if (stripeProductId !== currentPricing.stripeProductId) {
          body.stripeProductId = stripeProductId;
          console.log(`✅ Product updated: ${currentPricing.stripeProductId} → ${stripeProductId}`);
        }
      }

      // Create new Stripe price if price, trial period, or tier changed
      const needsNewPrice = body.monthlyPriceCents || body.freeTrialDays !== undefined || body.tier;
      if (needsNewPrice && stripeProductId) {
        console.log(`💰 Creating new Stripe price: $${monthlyPriceCents/100}/month, ${freeTrialDays} trial days`);
        
        // Check for active subscriptions on the old price before archiving
        let activeSubscriptionsCount = 0;
        if (currentPricing.stripePriceId) {
          try {
            activeSubscriptionsCount = await getActiveSubscriptionsForPrice(currentPricing.stripePriceId);
            console.log(`📊 Found ${activeSubscriptionsCount} active subscriptions using old price`);
          } catch (error) {
            console.warn(`⚠️ Could not check active subscriptions for old price:`, error);
          }
        }

        // Create the new price
        let newStripePriceId: string;
        try {
          newStripePriceId = await createOrUpdateStripePrice(
            stripeProductId,
            monthlyPriceCents,
            'month',
            freeTrialDays
          );
          console.log(`✅ New Stripe price created: ${newStripePriceId}`);
        } catch (error: any) {
          console.error(`❌ Failed to create new Stripe price:`, error);
          throw new Error(`Failed to create new Stripe price: ${error.message || error}`);
        }

        // Archive the old price (but only if we successfully created the new one)
        if (currentPricing.stripePriceId && currentPricing.stripePriceId !== newStripePriceId) {
          try {
            console.log(`🗃️ Archiving old Stripe price: ${currentPricing.stripePriceId}`);
            await archiveStripePrice(currentPricing.stripePriceId);
            console.log(`✅ Old price archived successfully`);
            
            if (activeSubscriptionsCount > 0) {
              console.log(`ℹ️ Note: ${activeSubscriptionsCount} active subscriptions will continue using the archived price until they renew`);
            }
          } catch (error) {
            console.error(`⚠️ Failed to archive old price ${currentPricing.stripePriceId}:`, error);
            // Don't fail the entire operation if archiving fails, but log it
            console.log(`⚠️ Continuing with price update despite archive failure`);
          }
        }
        
        // Update the database with the new price ID
        body.stripePriceId = newStripePriceId;
        console.log(`📝 Will update database with new price ID: ${newStripePriceId}`);
      }
    }
    
    const pricing = await prisma.subscriptionPricing.update({
      where: { pricingId: params.pricingId },
      data: body,
    });
    
    console.log(`✅ Database updated successfully for pricing tier "${pricing.tier}":`, {
      pricingId: pricing.pricingId,
      tier: pricing.tier,
      stripePriceId: pricing.stripePriceId,
      monthlyPriceCents: pricing.monthlyPriceCents,
      freeTrialDays: pricing.freeTrialDays
    });
    
    return NextResponse.json({ pricing });
  } catch (error: any) {
    console.error("❌ Error updating pricing:", error);
    
    // Provide more specific error messages
    let errorMessage = "Failed to update pricing";
    if (error.message) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
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