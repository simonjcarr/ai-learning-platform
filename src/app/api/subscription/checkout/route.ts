import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createOrRetrieveCustomer, createCheckoutSession } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { priceId, tier } = await req.json();

    if (!priceId || !tier) {
      return NextResponse.json(
        { error: 'Missing priceId or tier' },
        { status: 400 }
      );
    }

    // Get the pricing details to check for free trial
    const pricingDetails = await prisma.subscriptionPricing.findFirst({
      where: { stripePriceId: priceId },
      select: { freeTrialDays: true },
    });

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    
    if (!customerId) {
      customerId = await createOrRetrieveCustomer(
        user.email,
        user.clerkUserId,
        `${user.firstName} ${user.lastName}`.trim() || user.username || undefined
      );

      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { clerkUserId: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true&tier=${tier}`;
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pricing?cancelled=true`;

    const session = await createCheckoutSession(
      customerId,
      priceId,
      successUrl,
      cancelUrl,
      userId,
      pricingDetails?.freeTrialDays
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}