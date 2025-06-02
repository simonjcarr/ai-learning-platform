import { prisma } from '../src/lib/prisma';

async function debugUserMismatch() {
  console.log('🔍 Debug User ID Mismatch');
  console.log('='.repeat(50));

  const email = 'simon@soxprox.com';
  const dashboardClerkId = 'user_2xv7es7sz1zWHb8SgCmpnGbxYQX';
  const databaseClerkId = 'user_2xuBCEe5uMF3AJfzQpySpjCqQgo';

  try {
    console.log('\n1. Search by email:');
    const userByEmail = await prisma.user.findUnique({
      where: { email },
      select: {
        clerkUserId: true,
        email: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        appSpecificCreatedAt: true,
      },
    });
    console.log('User by email:', JSON.stringify(userByEmail, null, 2));

    console.log('\n2. Search by dashboard Clerk ID:');
    const userByDashboardId = await prisma.user.findUnique({
      where: { clerkUserId: dashboardClerkId },
      select: {
        clerkUserId: true,
        email: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        appSpecificCreatedAt: true,
      },
    });
    console.log('User by dashboard ID:', JSON.stringify(userByDashboardId, null, 2));

    console.log('\n3. Search by database Clerk ID:');
    const userByDatabaseId = await prisma.user.findUnique({
      where: { clerkUserId: databaseClerkId },
      select: {
        clerkUserId: true,
        email: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        appSpecificCreatedAt: true,
      },
    });
    console.log('User by database ID:', JSON.stringify(userByDatabaseId, null, 2));

    console.log('\n4. Search for all users with this email:');
    const allUsersWithEmail = await prisma.user.findMany({
      where: { email },
      select: {
        clerkUserId: true,
        email: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        appSpecificCreatedAt: true,
      },
      orderBy: { appSpecificCreatedAt: 'desc' },
    });
    console.log('All users with this email:', JSON.stringify(allUsersWithEmail, null, 2));

    console.log('\n5. The issue:');
    if (userByEmail && userByEmail.clerkUserId !== dashboardClerkId) {
      console.log('❌ MISMATCH FOUND!');
      console.log(`- Database user has Clerk ID: ${userByEmail.clerkUserId}`);
      console.log(`- Dashboard is using Clerk ID: ${dashboardClerkId}`);
      console.log('- This means the user is signed in with a different Clerk account than the one in the database');
      console.log('- Or there are multiple user records for the same email');
    }

  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugUserMismatch().catch(console.error);