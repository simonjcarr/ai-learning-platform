import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user from Clerk
    const clerkUser = await currentUser();
    
    if (!clerkUser) {
      return NextResponse.json({ error: 'User not found in Clerk' }, { status: 404 });
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    
    if (!email) {
      return NextResponse.json({ error: 'No email address found' }, { status: 400 });
    }

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { clerkUserId: userId },
      update: {
        email,
        username: clerkUser.username || null,
        firstName: clerkUser.firstName || null,
        lastName: clerkUser.lastName || null,
        imageUrl: clerkUser.imageUrl || null,
        lastLoginToApp: new Date(),
      },
      create: {
        clerkUserId: userId,
        email,
        username: clerkUser.username || null,
        firstName: clerkUser.firstName || null,
        lastName: clerkUser.lastName || null,
        imageUrl: clerkUser.imageUrl || null,
      },
    });

    console.log(`✅ User ${userId} manually synced with email: ${email}`);

    return NextResponse.json({ 
      message: 'User synced successfully',
      user: {
        id: user.clerkUserId,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
      }
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync user' },
      { status: 500 }
    );
  }
}