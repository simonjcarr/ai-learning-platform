import { prisma } from '../src/lib/prisma';
import { checkSubscription } from '../src/lib/feature-access';

async function debugSubscriptionAPI() {
  console.log('🔍 Debug Subscription API for simon@soxprox.com');
  console.log('='.repeat(60));

  try {
    // 1. Check database directly
    console.log('\n1. Database Query:');
    const user = await prisma.user.findUnique({
      where: { email: 'simon@soxprox.com' },
      select: {
        clerkUserId: true,
        email: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionCurrentPeriodEnd: true,
        role: true,
      },
    });

    if (!user) {
      console.log('❌ User not found in database');
      return;
    }

    console.log('Database user data:');
    console.log(JSON.stringify(user, null, 2));

    // 2. Test feature access system
    console.log('\n2. Feature Access System:');
    const featureAccess = await checkSubscription(user.clerkUserId);
    console.log('Feature access result:');
    console.log(JSON.stringify(featureAccess, null, 2));

    // 3. Check if this is what API endpoint returns
    console.log('\n3. Expected API Response:');
    const expectedResponse = {
      tier: featureAccess.tier,
      isActive: featureAccess.isActive,
      status: user.subscriptionStatus,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      cancelledAt: null,
      hasStripeCustomer: true,
      permissions: featureAccess.permissions,
    };

    console.log('Expected response:');
    console.log(JSON.stringify(expectedResponse, null, 2));

    console.log('\n✅ Debug complete!');
    console.log('If dashboard shows different data, it\'s a caching issue on the frontend.');

  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSubscriptionAPI().catch(console.error);