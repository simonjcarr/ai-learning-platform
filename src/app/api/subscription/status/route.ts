import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { checkSubscription } from '@/lib/subscription-check';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the subscription check service to get full subscription info
    const subscription = await checkSubscription(userId);

    // Get user data for additional fields
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        subscriptionStatus: true,
        subscriptionCurrentPeriodEnd: true,
        subscriptionCancelledAt: true,
        stripeCustomerId: true,
      },
    });
    
    return NextResponse.json({
      tier: subscription.tier,
      status: user?.subscriptionStatus || 'INACTIVE',
      isActive: subscription.isActive,
      permissions: subscription.permissions,
      currentPeriodEnd: user?.subscriptionCurrentPeriodEnd,
      cancelledAt: user?.subscriptionCancelledAt,
      hasStripeCustomer: !!user?.stripeCustomerId,
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    );
  }
}