import { prisma } from '../src/lib/prisma';
import { clerkClient } from '@clerk/nextjs/server';

async function fixUserEmails() {
  try {
    console.log('🔍 Fetching users with temp@example.com email...\n');

    // Find all users with the temp email
    const usersWithTempEmail = await prisma.user.findMany({
      where: {
        email: 'temp@example.com',
      },
    });

    if (usersWithTempEmail.length === 0) {
      console.log('✅ No users found with temp@example.com email');
      return;
    }

    console.log(`Found ${usersWithTempEmail.length} users with temp email\n`);

    for (const user of usersWithTempEmail) {
      console.log(`Processing user: ${user.clerkUserId}`);
      
      try {
        // Fetch the actual user data from Clerk
        const clerkUser = await clerkClient.users.getUser(user.clerkUserId);
        
        const actualEmail = clerkUser.emailAddresses[0]?.emailAddress;
        
        if (actualEmail && actualEmail !== 'temp@example.com') {
          // Update the user in the database
          await prisma.user.update({
            where: { clerkUserId: user.clerkUserId },
            data: {
              email: actualEmail,
              firstName: clerkUser.firstName || null,
              lastName: clerkUser.lastName || null,
              username: clerkUser.username || null,
              imageUrl: clerkUser.imageUrl || null,
            },
          });
          
          console.log(`✅ Updated email from temp@example.com to ${actualEmail}`);
          
          // Also update Stripe customer if they have one
          if (user.stripeCustomerId) {
            console.log(`   Updating Stripe customer email...`);
            // Note: This would require importing stripe and updating the customer
            // For now, just log that it needs to be done
            console.log(`   ⚠️  Please update Stripe customer ${user.stripeCustomerId} manually`);
          }
        } else {
          console.log(`⚠️  Could not find valid email for user ${user.clerkUserId}`);
        }
      } catch (error) {
        console.error(`❌ Error processing user ${user.clerkUserId}:`, error);
      }
    }
    
    console.log('\n✅ Email fix complete!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserEmails();