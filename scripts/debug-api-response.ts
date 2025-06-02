import { prisma } from '../src/lib/prisma';
import { checkSubscription } from '../src/lib/subscription-check';

async function debugAPIResponse() {
  console.log('🔍 Debug API Response vs Database for simon@soxprox.com');
  console.log('='.repeat(70));

  try {
    // 1. Get user from database
    const user = await prisma.user.findUnique({
      where: { email: 'simon@soxprox.com' },
      select: {
        clerkUserId: true,
        email: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionCurrentPeriodEnd: true,
        subscriptionCancelledAt: true,
        stripeCustomerId: true,
        role: true,
      },
    });

    if (!user) {
      console.log('❌ User not found in database');
      return;
    }

    console.log('\n1. Database user data:');
    console.log(JSON.stringify(user, null, 2));

    // 2. Test subscription-check.ts 
    console.log('\n2. subscription-check.ts result:');
    const subscriptionCheck = await checkSubscription(user.clerkUserId);
    console.log(JSON.stringify(subscriptionCheck, null, 2));

    // 3. Simulate what API endpoint returns
    console.log('\n3. What API endpoint returns:');
    const apiResponse = {
      tier: subscriptionCheck.tier,  // ← This is the problem!
      status: user.subscriptionStatus || 'INACTIVE',
      isActive: subscriptionCheck.isActive,
      permissions: subscriptionCheck.permissions,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      cancelledAt: user.subscriptionCancelledAt,
      hasStripeCustomer: !!user.stripeCustomerId,
    };
    console.log(JSON.stringify(apiResponse, null, 2));

    // 4. Debug the logic in subscription-check.ts
    console.log('\n4. Debug subscription-check.ts logic:');
    console.log(`subscriptionStatus: "${user.subscriptionStatus}"`);
    console.log(`subscriptionTier: "${user.subscriptionTier}"`);
    console.log(`isActive: ${user.subscriptionStatus === 'ACTIVE'}`);
    console.log(`effectiveTier: ${user.subscriptionStatus === 'ACTIVE' ? user.subscriptionTier : 'FREE'}`);

  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAPIResponse().catch(console.error);