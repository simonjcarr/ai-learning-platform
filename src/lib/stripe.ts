import Stripe from 'stripe';

// Only initialize Stripe on the server side
export const stripe = typeof window === 'undefined' && process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-04-30.basil',
      typescript: true,
    })
  : null;

// Dynamic subscription tiers loaded from database
export async function getSubscriptionTiers() {
  const { prisma } = await import('@/lib/prisma');
  
  try {
    const tiers = await prisma.subscriptionPricing.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    
    const tierMap: Record<string, any> = {};
    
    tiers.forEach((tier) => {
      tierMap[tier.tier] = {
        name: tier.tier,
        price: tier.monthlyPriceCents / 100,
        features: tier.features,
        stripePriceId: tier.stripePriceId,
        freeTrialDays: tier.freeTrialDays,
        isActive: tier.isActive,
      };
    });
    
    // Ensure FREE tier exists as fallback
    if (!tierMap['FREE']) {
      tierMap['FREE'] = {
        name: 'Free',
        price: 0,
        features: ['Access to basic articles', 'Limited interactive examples', 'Community support'],
        stripePriceId: null,
        freeTrialDays: 0,
        isActive: true,
      };
    }
    
    return tierMap;
  } catch (error) {
    console.error('Error loading subscription tiers:', error);
    // Fallback to default structure
    return {
      FREE: {
        name: 'Free',
        price: 0,
        features: ['Access to basic articles', 'Limited interactive examples', 'Community support'],
        stripePriceId: null,
        freeTrialDays: 0,
        isActive: true,
      },
    };
  }
}

// For backward compatibility - use the dynamic version in new code
export const SUBSCRIPTION_TIERS = {
  FREE: {
    name: 'Free',
    price: 0,
    features: ['Access to basic articles', 'Limited interactive examples', 'Community support'],
  },
};

export async function createOrRetrieveCustomer(
  email: string,
  clerkUserId: string,
  name?: string
): Promise<string> {
  if (!stripe) {
    throw new Error('Stripe is not initialized');
  }

  // First, try to retrieve existing customer by metadata
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      clerkUserId,
    },
  });

  return customer.id;
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  clerkUserId: string,
  trialPeriodDays?: number
) {
  if (!stripe) {
    throw new Error('Stripe is not initialized');
  }

  const sessionParams: any = {
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      clerkUserId,
    },
  };

  // Add subscription data with trial if specified
  if (trialPeriodDays && trialPeriodDays > 0) {
    sessionParams.subscription_data = {
      trial_period_days: trialPeriodDays,
    };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return session;
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string
) {
  if (!stripe) {
    throw new Error('Stripe is not initialized');
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session;
  } catch (error: any) {
    console.error('Portal session creation error details:', {
      message: error.message,
      type: error.type,
      statusCode: error.statusCode,
    });
    
    // If no configuration exists, provide a more helpful error
    if (error.message?.includes('No configuration provided')) {
      throw new Error(
        'Stripe Customer Portal is not configured. Please visit https://dashboard.stripe.com/test/settings/billing/portal to set it up.'
      );
    }
    
    throw error;
  }
}

export async function createOrUpdateStripeProduct(
  tierName: string,
  features: string[]
): Promise<string> {
  if (!stripe) {
    throw new Error('Stripe is not initialized');
  }

  try {
    // Try to find existing product
    const products = await stripe.products.list({
      limit: 100,
    });

    let product = products.data.find(p => p.name === tierName);

    if (product) {
      // Update existing product
      product = await stripe.products.update(product.id, {
        description: features.join(', '),
        metadata: {
          features: JSON.stringify(features),
        },
      });
    } else {
      // Create new product
      product = await stripe.products.create({
        name: tierName,
        description: features.join(', '),
        metadata: {
          features: JSON.stringify(features),
        },
      });
    }

    return product.id;
  } catch (error) {
    console.error('Error creating/updating Stripe product:', error);
    throw error;
  }
}

export async function createOrUpdateStripePrice(
  productId: string,
  unitAmount: number,
  interval: 'month' | 'year',
  trialPeriodDays?: number
): Promise<string> {
  if (!stripe) {
    throw new Error('Stripe is not initialized');
  }

  try {
    const priceParams: any = {
      product: productId,
      unit_amount: unitAmount,
      currency: 'usd',
      recurring: {
        interval,
      },
    };

    if (trialPeriodDays && trialPeriodDays > 0) {
      priceParams.recurring.trial_period_days = trialPeriodDays;
    }

    const price = await stripe.prices.create(priceParams);
    return price.id;
  } catch (error) {
    console.error('Error creating Stripe price:', error);
    throw error;
  }
}

export async function getActiveSubscriptionsForPrice(priceId: string): Promise<number> {
  if (!stripe) {
    throw new Error('Stripe is not initialized');
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      price: priceId,
      status: 'active',
      limit: 100,
    });

    return subscriptions.data.length;
  } catch (error) {
    console.error('Error getting active subscriptions:', error);
    throw error;
  }
}

export async function archiveStripePrice(priceId: string): Promise<void> {
  if (!stripe) {
    throw new Error('Stripe is not initialized');
  }

  try {
    await stripe.prices.update(priceId, {
      active: false,
    });
    console.log(`✅ Successfully archived Stripe price: ${priceId}`);
  } catch (error) {
    console.error('Error archiving Stripe price:', error);
    throw error;
  }
}

/**
 * Get subscription details for a given price ID
 * Useful for understanding impact before price changes
 */
export async function getSubscriptionDetailsForPrice(priceId: string) {
  if (!stripe) {
    throw new Error('Stripe is not initialized');
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      price: priceId,
      limit: 100,
    });

    const details = {
      total: subscriptions.data.length,
      active: subscriptions.data.filter(sub => sub.status === 'active').length,
      trialing: subscriptions.data.filter(sub => sub.status === 'trialing').length,
      pastDue: subscriptions.data.filter(sub => sub.status === 'past_due').length,
      canceled: subscriptions.data.filter(sub => sub.status === 'canceled').length,
      subscriptions: subscriptions.data.map(sub => ({
        id: sub.id,
        status: sub.status,
        customerId: sub.customer,
        currentPeriodEnd: new Date(sub.currentPeriodEnd * 1000),
      }))
    };

    console.log(`📊 Subscription details for price ${priceId}:`, {
      total: details.total,
      active: details.active,
      trialing: details.trialing,
      pastDue: details.pastDue,
      canceled: details.canceled
    });

    return details;
  } catch (error) {
    console.error('Error getting subscription details:', error);
    throw error;
  }
}

export async function getStripeProductInfo(productId: string) {
  if (!stripe) {
    throw new Error('Stripe is not initialized');
  }

  try {
    const product = await stripe.products.retrieve(productId);
    return product;
  } catch (error) {
    console.error('Error retrieving Stripe product:', error);
    throw error;
  }
}