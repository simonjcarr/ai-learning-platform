import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY is not set in .env.local');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

async function setupStripePortal() {
  try {
    console.log('🚀 Setting up Stripe Customer Portal configuration...\n');

    // Create portal configuration
    const configuration = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'IT Learning Platform - Manage your subscription',
      },
      features: {
        customer_update: {
          enabled: true,
          allowed_updates: ['email', 'name', 'address', 'phone', 'tax_id'],
        },
        invoice_history: {
          enabled: true,
        },
        payment_method_update: {
          enabled: true,
        },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: [
              'too_expensive',
              'missing_features',
              'switched_service',
              'unused',
              'other',
            ],
          },
        },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'create_prorations',
          products: [
            {
              product: 'prod_SO5fYT3V1Hwi6l', // Standard product
              prices: ['price_1RTJUBDAMTjBWDhtJZc7bEer'], // Standard price
            },
            {
              product: 'prod_SO5fUNxBoDxbvC', // Max product
              prices: ['price_1RTJUBDAMTjBWDhtUNBpFPjJ'], // Max price
            },
          ],
        },
      },
      default_return_url: process.env.NEXT_PUBLIC_APP_URL + '/dashboard',
    });

    console.log('✅ Customer Portal configuration created!');
    console.log(`   Configuration ID: ${configuration.id}`);
    console.log(`   Is default: ${configuration.is_default}\n`);

    // Make it the default configuration
    if (!configuration.is_default) {
      await stripe.billingPortal.configurations.update(configuration.id, {
        default: true,
      });
      console.log('✅ Set as default configuration\n');
    }

    console.log('✅ Setup complete! Your customer portal is now configured.');
    console.log('   Customers can now manage their subscriptions through the portal.');

  } catch (error) {
    console.error('❌ Error setting up Stripe portal:', error);
    process.exit(1);
  }
}

setupStripePortal();