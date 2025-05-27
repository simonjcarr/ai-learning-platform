import { prisma } from '../src/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

async function updateMyEmail() {
  const clerkUserId = 'user_2xda7CAPRPNvaEhj0zZkbU4dota'; // Your Clerk user ID from the logs
  const correctEmail = 'simonjcarr@gmail.com';
  
  try {
    console.log('📧 Updating email in database...\n');
    
    // Update the user in the database
    const updatedUser = await prisma.user.update({
      where: { clerkUserId },
      data: {
        email: correctEmail,
      },
    });
    
    console.log(`✅ Updated email to ${correctEmail} in database`);
    
    // If user has a Stripe customer ID, update it there too
    if (updatedUser.stripeCustomerId) {
      console.log('\n📧 Updating email in Stripe...');
      
      await stripe.customers.update(updatedUser.stripeCustomerId, {
        email: correctEmail,
      });
      
      console.log(`✅ Updated email to ${correctEmail} in Stripe`);
    }
    
    console.log('\n✅ All done! Your email is now correctly set.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateMyEmail();