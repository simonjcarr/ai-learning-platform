import { auth } from '@clerk/nextjs/server';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkFeatureAccess as baseCheckFeatureAccess, checkFeatureUsage as baseCheckFeatureUsage, FeatureAccess } from '@/lib/feature-access';

/**
 * Check feature access with admin bypass
 * Admins have access to all features regardless of subscription
 */
export async function checkFeatureAccessWithAdmin(
  featureKey: string,
  userId?: string | null
): Promise<FeatureAccess> {
  if (!userId) {
    const authResult = await auth();
    userId = authResult.userId;
  }

  if (!userId) {
    return {
      hasAccess: false,
      reason: 'User not authenticated'
    };
  }

  try {
    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    if (user?.role === Role.ADMIN) {
      return {
        hasAccess: true,
        limitValue: -1, // Unlimited for admins
        reason: 'Admin access - unlimited'
      };
    }

    // For non-admins, use normal feature access check
    return await baseCheckFeatureAccess(featureKey, userId);
  } catch (error) {
    console.error('Error checking feature access with admin:', error);
    return {
      hasAccess: false,
      reason: 'Error checking feature access'
    };
  }
}

/**
 * Check feature usage with admin bypass
 * Admins have unlimited usage regardless of limits
 */
export async function checkFeatureUsageWithAdmin(
  featureKey: string,
  userId?: string | null,
  period: 'daily' | 'monthly' = 'daily'
): Promise<{ 
  hasAccess: boolean; 
  currentUsage: number; 
  limit: number; 
  remaining: number;
  reason?: string;
}> {
  if (!userId) {
    const authResult = await auth();
    userId = authResult.userId;
  }

  if (!userId) {
    return {
      hasAccess: false,
      currentUsage: 0,
      limit: 0,
      remaining: 0,
      reason: 'User not authenticated'
    };
  }

  try {
    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    if (user?.role === Role.ADMIN) {
      return {
        hasAccess: true,
        currentUsage: 0,
        limit: -1, // Unlimited for admins
        remaining: -1,
        reason: 'Admin access - unlimited usage'
      };
    }

    // For non-admins, use normal usage check
    return await baseCheckFeatureUsage(featureKey, userId, period);
  } catch (error) {
    console.error('Error checking feature usage with admin:', error);
    return {
      hasAccess: false,
      currentUsage: 0,
      limit: 0,
      remaining: 0,
      reason: 'Error checking feature usage'
    };
  }
}

/**
 * Require feature access with admin bypass
 */
export async function requireFeatureAccessWithAdmin(
  featureKey: string,
  userId?: string | null
): Promise<FeatureAccess> {
  const access = await checkFeatureAccessWithAdmin(featureKey, userId);
  
  if (!access.hasAccess) {
    throw new Error(access.reason || `Access denied to feature: ${featureKey}`);
  }
  
  return access;
}