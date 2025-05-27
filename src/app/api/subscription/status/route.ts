import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user subscription status
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionCurrentPeriodEnd: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if subscription is still active
    const isActive = user.subscriptionStatus === 'ACTIVE' && 
                    user.subscriptionCurrentPeriodEnd && 
                    new Date(user.subscriptionCurrentPeriodEnd) > new Date();

    return NextResponse.json({
      tier: user.subscriptionTier,
      status: user.subscriptionStatus,
      isActive,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      hasStripeCustomer: !!user.stripeCustomerId,
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    );
  }
}