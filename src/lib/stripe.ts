import Stripe from 'stripe';

// Only initialize Stripe on the server side
export const stripe = typeof window === 'undefined' && process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    })
  : null;

export const SUBSCRIPTION_TIERS = {
  FREE: {
    name: 'Free',
    price: 0,
    features: [
      'Access to basic articles',
      'Limited interactive examples',
      'Community support',
    ],
  },
  STANDARD: {
    name: 'Standard',
    price: Number(process.env.STRIPE_STANDARD_PRICE_MONTHLY) || 8,
    features: [
      'All Free features',
      'Unlimited article access',
      'All interactive examples',
      'AI-powered chat support',
      'Progress tracking',
      'Download articles for offline reading',
    ],
  },
  MAX: {
    name: 'Max',
    price: Number(process.env.STRIPE_MAX_PRICE_MONTHLY) || 14,
    features: [
      'All Standard features',
      'Priority AI chat support',
      'Personalized learning paths',
      'Advanced analytics',
      'Early access to new content',
      'Direct support from experts',
      'Custom curated lists',
    ],
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
  clerkUserId: string
) {
  if (!stripe) {
    throw new Error('Stripe is not initialized');
  }

  const session = await stripe.checkout.sessions.create({
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
  });

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