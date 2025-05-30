import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

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

// Dynamic tier permissions - these are default values that can be customized per tier
function getDefaultPermissions(tier: string): SubscriptionPermissions {
  // For FREE tier (case-insensitive)
  if (tier.toUpperCase() === 'FREE') {
    return {
      canAccessArticles: true, // Limited access
      canGenerateContent: false,
      canUseAIChat: false,
      canDownloadContent: false,
      canCreateCustomLists: false,
      canAccessAnalytics: false,
      canGetPrioritySupport: false,
      dailyAIChatsLimit: 0,
      monthlyDownloadsLimit: 0,
    };
  }
  
  // For paid tiers, provide generous defaults
  // These could be stored in the database in the future
  const monthlyPriceCents = getEstimatedPrice(tier);
  
  if (monthlyPriceCents === 0) {
    // Free tier
    return getDefaultPermissions('FREE');
  } else if (monthlyPriceCents < 1000) {
    // Basic paid tier (< $10/month)
    return {
      canAccessArticles: true,
      canGenerateContent: true,
      canUseAIChat: true,
      canDownloadContent: true,
      canCreateCustomLists: true,
      canAccessAnalytics: true,
      canGetPrioritySupport: false,
      dailyAIChatsLimit: 50,
      monthlyDownloadsLimit: 100,
    };
  } else {
    // Premium tier (>= $10/month)
    return {
      canAccessArticles: true,
      canGenerateContent: true,
      canUseAIChat: true,
      canDownloadContent: true,
      canCreateCustomLists: true,
      canAccessAnalytics: true,
      canGetPrioritySupport: true,
      dailyAIChatsLimit: -1, // Unlimited
      monthlyDownloadsLimit: -1, // Unlimited
    };
  }
}

// Helper function to estimate price for tier-based permissions
function getEstimatedPrice(tier: string): number {
  // This is a simple heuristic - in a real app you'd query the database
  const tierUpper = tier.toUpperCase();
  if (tierUpper === 'FREE') return 0;
  if (tierUpper.includes('BASIC') || tierUpper.includes('STANDARD') || tierUpper.includes('PRO')) return 500;
  if (tierUpper.includes('PREMIUM') || tierUpper.includes('MAX') || tierUpper.includes('ENTERPRISE')) return 1000;
  return 500; // Default to basic tier pricing
}

export async function checkSubscription(userId?: string | null) {
  if (!userId) {
    const authResult = await auth();
    userId = authResult.userId;
  }

  if (!userId) {
    return {
      tier: 'FREE',
      isActive: false,
      permissions: getDefaultPermissions('FREE'),
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
      tier: 'FREE',
      isActive: false,
      permissions: getDefaultPermissions('FREE'),
    };
  }

  // Check if subscription is active
  // If status is ACTIVE, consider it active even if period end is null or in the past
  // This handles cases where the subscription webhook hasn't updated the period end yet
  const isActive = user.subscriptionStatus === 'ACTIVE';

  const effectiveTier = isActive ? user.subscriptionTier : 'FREE';

  return {
    tier: effectiveTier,
    isActive,
    permissions: getDefaultPermissions(effectiveTier),
  };
}

export async function requireSubscription(
  requiredTier: string = 'STANDARD',
  userId?: string | null
) {
  const subscription = await checkSubscription(userId);
  
  // Dynamic tier hierarchy based on pricing - higher price = higher access
  const tierHierarchy: Record<string, number> = {
    'FREE': 0,
  };
  
  // Add dynamic tiers from database
  try {
    const pricingTiers = await prisma.subscriptionPricing.findMany({
      select: { tier: true, monthlyPriceCents: true },
      orderBy: { monthlyPriceCents: 'asc' },
    });
    
    pricingTiers.forEach((pricing, index) => {
      tierHierarchy[pricing.tier.toUpperCase()] = pricing.monthlyPriceCents === 0 ? 0 : index + 1;
    });
  } catch (error) {
    console.error('Error loading tier hierarchy:', error);
    // Fallback hierarchy
    tierHierarchy['STANDARD'] = 1;
    tierHierarchy['PRO'] = 1;
    tierHierarchy['MAX'] = 2;
    tierHierarchy['PREMIUM'] = 2;
  }

  const userTierLevel = tierHierarchy[subscription.tier.toUpperCase()] || 0;
  const requiredTierLevel = tierHierarchy[requiredTier.toUpperCase()] || 1;
  
  const hasAccess = userTierLevel >= requiredTierLevel;

  return {
    hasAccess,
    subscription,
  };
}