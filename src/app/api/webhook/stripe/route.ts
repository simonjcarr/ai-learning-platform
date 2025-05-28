import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import { emails } from '@/lib/email-service';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

async function getOrCreateUser(customerId: string) {
  if (!stripe) {
    throw new Error('Stripe is not initialized');
  }
  
  const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
  
  if (!customer.metadata.clerkUserId) {
    throw new Error('Customer missing clerkUserId in metadata');
  }

  // Ensure user exists in database
  const user = await prisma.user.findUnique({
    where: { clerkUserId: customer.metadata.clerkUserId },
  });

  if (!user) {
    throw new Error(`User not found for clerkUserId: ${customer.metadata.clerkUserId}`);
  }

  // Update user with Stripe customer ID if not already set
  if (!user.stripeCustomerId) {
    await prisma.user.update({
      where: { clerkUserId: customer.metadata.clerkUserId },
      data: { stripeCustomerId: customerId },
    });
  }

  return user;
}

function mapPriceToTier(priceAmount: number): SubscriptionTier {
  const standardPrice = Number(process.env.STRIPE_STANDARD_PRICE_MONTHLY) || 8;
  const maxPrice = Number(process.env.STRIPE_MAX_PRICE_MONTHLY) || 14;

  // Convert from cents to dollars
  const amount = priceAmount / 100;

  if (amount === standardPrice) return 'STANDARD';
  if (amount === maxPrice) return 'MAX';
  
  // Default to standard if price doesn't match
  console.warn(`Unknown price amount: ${amount}, defaulting to STANDARD tier`);
  return 'STANDARD';
}

function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'canceled':
      return 'CANCELLED';
    case 'past_due':
      return 'PAST_DUE';
    default:
      return 'INACTIVE';
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not initialized' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Processing ${event.type} for subscription ${subscription.id} with status ${subscription.status}`);
        
        const user = await getOrCreateUser(subscription.customer as string);
        
        const priceItem = subscription.items.data[0];
        const tier = mapPriceToTier(priceItem.price.unit_amount || 0);
        const status = mapStripeStatus(subscription.status);
        
        console.log(`Subscription details - Tier: ${tier}, Status: ${status}, Period End: ${subscription.current_period_end}`);

        // Update user subscription
        const periodEnd = subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000)
          : null;

        // Validate the date
        if (periodEnd && isNaN(periodEnd.getTime())) {
          console.error('Invalid subscription period end date:', subscription.current_period_end);
          throw new Error('Invalid subscription period end date');
        }

        const updatedUser = await prisma.user.update({
          where: { clerkUserId: user.clerkUserId },
          data: {
            subscriptionId: subscription.id,
            subscriptionTier: tier,
            subscriptionStatus: status,
            subscriptionCurrentPeriodEnd: periodEnd,
          },
        });

        // Create history record
        await prisma.subscriptionHistory.create({
          data: {
            clerkUserId: user.clerkUserId,
            subscriptionId: subscription.id,
            eventType: event.type.replace('customer.subscription.', ''),
            previousTier: user.subscriptionTier,
            newTier: tier,
            previousStatus: user.subscriptionStatus,
            newStatus: status,
            amount: priceItem.price.unit_amount,
            currency: priceItem.price.currency,
            stripeEventId: event.id,
            metadata: event.data.object,
          },
        });

        // Send subscription confirmation email for new active subscriptions
        if (event.type === 'customer.subscription.created' && status === 'ACTIVE') {
          try {
            await emails.sendSubscriptionConfirmation(
              user.email,
              user.firstName || "User",
              tier,
              priceItem.price.unit_amount || 0
            );
            console.log(`Subscription confirmation email sent to ${user.email}`);
          } catch (emailError) {
            console.error(`Failed to send subscription confirmation to ${user.email}:`, emailError);
          }
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const user = await getOrCreateUser(subscription.customer as string);

        // Update user subscription to cancelled/free
        const cancelPeriodEnd = subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000)
          : null;

        await prisma.user.update({
          where: { clerkUserId: user.clerkUserId },
          data: {
            subscriptionTier: 'FREE',
            subscriptionStatus: 'CANCELLED',
            subscriptionCurrentPeriodEnd: cancelPeriodEnd,
          },
        });

        // Create history record
        await prisma.subscriptionHistory.create({
          data: {
            clerkUserId: user.clerkUserId,
            subscriptionId: subscription.id,
            eventType: 'deleted',
            previousTier: user.subscriptionTier,
            newTier: 'FREE',
            previousStatus: user.subscriptionStatus,
            newStatus: 'CANCELLED',
            stripeEventId: event.id,
            metadata: event.data.object,
          },
        });

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        
        if (invoice.subscription && stripe) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );
          const user = await getOrCreateUser(subscription.customer as string);

          // Update subscription end date
          const renewalPeriodEnd = subscription.current_period_end 
            ? new Date(subscription.current_period_end * 1000)
            : null;

          await prisma.user.update({
            where: { clerkUserId: user.clerkUserId },
            data: {
              subscriptionCurrentPeriodEnd: renewalPeriodEnd,
            },
          });
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        
        if (invoice.subscription && stripe) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );
          const user = await getOrCreateUser(subscription.customer as string);

          // Update subscription status to past due
          await prisma.user.update({
            where: { clerkUserId: user.clerkUserId },
            data: {
              subscriptionStatus: 'PAST_DUE',
            },
          });

          // Create history record
          await prisma.subscriptionHistory.create({
            data: {
              clerkUserId: user.clerkUserId,
              subscriptionId: subscription.id,
              eventType: 'payment_failed',
              previousTier: user.subscriptionTier,
              newTier: user.subscriptionTier,
              previousStatus: user.subscriptionStatus,
              newStatus: 'PAST_DUE',
              stripeEventId: event.id,
              metadata: event.data.object,
            },
          });
        }

        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}