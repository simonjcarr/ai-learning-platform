import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { SubscriptionTier } from '@prisma/client';

export interface SubscriptionPermissions {
  canAccessArticles: boolean;
  canGenerateContent: boolean;
  canUseAIChat: boolean;
  canDownloadContent: boolean;
  canCreateCustomLists: boolean;
  canAccessAnalytics: boolean;
  canGetPrioritySupport: boolean;
  dailyAIChatsLimit: number;
  monthlyDownloadsLimit: number;
}

export const TIER_PERMISSIONS: Record<SubscriptionTier, SubscriptionPermissions> = {
  FREE: {
    canAccessArticles: true, // Limited access
    canGenerateContent: false,
    canUseAIChat: false,
    canDownloadContent: false,
    canCreateCustomLists: false,
    canAccessAnalytics: false,
    canGetPrioritySupport: false,
    dailyAIChatsLimit: 0,
    monthlyDownloadsLimit: 0,
  },
  STANDARD: {
    canAccessArticles: true, // Full access
    canGenerateContent: true,
    canUseAIChat: true,
    canDownloadContent: true,
    canCreateCustomLists: true,
    canAccessAnalytics: true,
    canGetPrioritySupport: false,
    dailyAIChatsLimit: 50,
    monthlyDownloadsLimit: 100,
  },
  MAX: {
    canAccessArticles: true, // Full access
    canGenerateContent: true,
    canUseAIChat: true,
    canDownloadContent: true,
    canCreateCustomLists: true,
    canAccessAnalytics: true,
    canGetPrioritySupport: true,
    dailyAIChatsLimit: -1, // Unlimited
    monthlyDownloadsLimit: -1, // Unlimited
  },
};

export async function checkSubscription(userId?: string | null) {
  if (!userId) {
    const authResult = await auth();
    userId = authResult.userId;
  }

  if (!userId) {
    return {
      tier: 'FREE' as SubscriptionTier,
      isActive: false,
      permissions: TIER_PERMISSIONS.FREE,
    };
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      subscriptionTier: true,
      subscriptionStatus: true,
      subscriptionCurrentPeriodEnd: true,
    },
  });

  if (!user) {
    return {
      tier: 'FREE' as SubscriptionTier,
      isActive: false,
      permissions: TIER_PERMISSIONS.FREE,
    };
  }

  // Check if subscription is active
  const isActive = 
    user.subscriptionStatus === 'ACTIVE' &&
    user.subscriptionCurrentPeriodEnd &&
    new Date(user.subscriptionCurrentPeriodEnd) > new Date();

  const effectiveTier = isActive ? user.subscriptionTier : 'FREE';

  return {
    tier: effectiveTier,
    isActive,
    permissions: TIER_PERMISSIONS[effectiveTier],
  };
}

export async function requireSubscription(
  requiredTier: SubscriptionTier = 'STANDARD',
  userId?: string | null
) {
  const subscription = await checkSubscription(userId);
  
  const tierHierarchy: Record<SubscriptionTier, number> = {
    FREE: 0,
    STANDARD: 1,
    MAX: 2,
  };

  const hasAccess = tierHierarchy[subscription.tier] >= tierHierarchy[requiredTier];

  return {
    hasAccess,
    subscription,
  };
}