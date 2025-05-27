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

async function setupStripeProducts() {
  try {
    console.log('🚀 Setting up Stripe products and prices...\n');

    // Create or retrieve products
    const standardProduct = await stripe.products.create({
      name: 'IT Learning Platform - Standard',
      description: 'Standard subscription with full access to articles and features',
    });

    const maxProduct = await stripe.products.create({
      name: 'IT Learning Platform - Max',
      description: 'Maximum subscription with all features plus priority support',
    });

    console.log('✅ Products created:');
    console.log(`   - Standard: ${standardProduct.id}`);
    console.log(`   - Max: ${maxProduct.id}\n`);

    // Create prices
    const standardPrice = await stripe.prices.create({
      product: standardProduct.id,
      unit_amount: 800, // $8.00 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });

    const maxPrice = await stripe.prices.create({
      product: maxProduct.id,
      unit_amount: 1400, // $14.00 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });

    console.log('✅ Prices created:');
    console.log(`   - Standard: ${standardPrice.id} ($${standardPrice.unit_amount! / 100}/month)`);
    console.log(`   - Max: ${maxPrice.id} ($${maxPrice.unit_amount! / 100}/month)\n`);

    // Display instructions
    console.log('📝 Add these to your .env.local file:\n');
    console.log(`NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID=${standardPrice.id}`);
    console.log(`NEXT_PUBLIC_STRIPE_MAX_PRICE_ID=${maxPrice.id}\n`);

    console.log('✅ Setup complete! Update your .env.local file and restart your app.');

  } catch (error) {
    console.error('❌ Error setting up Stripe products:', error);
    process.exit(1);
  }
}

setupStripeProducts();