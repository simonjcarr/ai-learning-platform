import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export interface FeatureAccess {
  hasAccess: boolean;
  limitValue?: number | null;
  configValue?: any;
  reason?: string;
}

export interface UserFeatureAccess {
  userId: string | null;
  tier: string;
  isActive: boolean;
  features: Map<string, FeatureAccess>;
}

/**
 * Check if a user has access to a specific feature
 */
export async function checkFeatureAccess(
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
    // Get user subscription info
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
        hasAccess: false,
        reason: 'User not found'
      };
    }

    // Check if subscription is active
    const isActive = user.subscriptionStatus === 'ACTIVE';
    const effectiveTier = isActive ? user.subscriptionTier : 'FREE';

    // Get the feature and its assignment for this tier
    const featureAssignment = await prisma.pricingTierFeature.findFirst({
      where: {
        feature: { featureKey },
        pricingTier: { tier: effectiveTier },
      },
      include: {
        feature: true,
        pricingTier: true,
      },
    });

    if (!featureAssignment) {
      // If no assignment found, check if feature exists and get its default
      const feature = await prisma.feature.findUnique({
        where: { featureKey },
      });

      if (!feature) {
        return {
          hasAccess: false,
          reason: 'Feature not found'
        };
      }

      if (!feature.isActive) {
        return {
          hasAccess: false,
          reason: 'Feature is deactivated'
        };
      }

      // Use feature's default value
      const defaultValue = feature.defaultValue as any;
      return {
        hasAccess: defaultValue?.enabled || false,
        limitValue: defaultValue?.limit,
        configValue: defaultValue,
        reason: defaultValue?.enabled ? undefined : 'Feature not available for this tier'
      };
    }

    if (!featureAssignment.feature.isActive) {
      return {
        hasAccess: false,
        reason: 'Feature is deactivated'
      };
    }

    return {
      hasAccess: featureAssignment.isEnabled,
      limitValue: featureAssignment.limitValue,
      configValue: featureAssignment.configValue,
      reason: featureAssignment.isEnabled ? undefined : 'Feature not available for this tier'
    };

  } catch (error) {
    console.error('Error checking feature access:', error);
    return {
      hasAccess: false,
      reason: 'Error checking feature access'
    };
  }
}

/**
 * Get all feature access for a user
 */
export async function getUserFeatureAccess(userId?: string | null): Promise<UserFeatureAccess | null> {
  if (!userId) {
    const authResult = await auth();
    userId = authResult.userId;
  }

  if (!userId) {
    return null;
  }

  try {
    // Get user subscription info
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      return null;
    }

    const isActive = user.subscriptionStatus === 'ACTIVE';
    const effectiveTier = isActive ? user.subscriptionTier : 'FREE';

    // Get all features and their assignments for this tier
    const features = await prisma.feature.findMany({
      where: { isActive: true },
      include: {
        pricingTierFeatures: {
          where: {
            pricingTier: { tier: effectiveTier },
          },
          include: {
            pricingTier: true,
          },
        },
      },
    });

    const featureMap = new Map<string, FeatureAccess>();

    features.forEach(feature => {
      const assignment = feature.pricingTierFeatures[0]; // Should only be one per tier
      
      if (assignment) {
        featureMap.set(feature.featureKey, {
          hasAccess: assignment.isEnabled,
          limitValue: assignment.limitValue,
          configValue: assignment.configValue,
        });
      } else {
        // Use feature's default value
        const defaultValue = feature.defaultValue as any;
        featureMap.set(feature.featureKey, {
          hasAccess: defaultValue?.enabled || false,
          limitValue: defaultValue?.limit,
          configValue: defaultValue,
        });
      }
    });

    return {
      userId,
      tier: effectiveTier,
      isActive,
      features: featureMap,
    };

  } catch (error) {
    console.error('Error getting user feature access:', error);
    return null;
  }
}

/**
 * Require specific feature access - throws error if not available
 */
export async function requireFeatureAccess(
  featureKey: string,
  userId?: string | null
): Promise<FeatureAccess> {
  const access = await checkFeatureAccess(featureKey, userId);
  
  if (!access.hasAccess) {
    throw new Error(access.reason || `Access denied to feature: ${featureKey}`);
  }
  
  return access;
}

/**
 * Check if user has reached a feature limit (for NUMERIC_LIMIT features)
 */
export async function checkFeatureUsage(
  featureKey: string,
  userId?: string | null,
  overridePeriod?: 'daily' | 'monthly'
): Promise<{ 
  hasAccess: boolean; 
  currentUsage: number; 
  limit: number; 
  remaining: number;
  period: 'daily' | 'monthly';
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
      period: 'daily',
      reason: 'User not authenticated'
    };
  }

  // Get the feature assignment with config to determine time period
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      subscriptionTier: true,
      subscriptionStatus: true,
    },
  });

  if (!user) {
    return {
      hasAccess: false,
      currentUsage: 0,
      limit: 0,
      remaining: 0,
      period: 'daily',
      reason: 'User not found'
    };
  }

  const isActive = user.subscriptionStatus === 'ACTIVE';
  const effectiveTier = isActive ? user.subscriptionTier : 'FREE';

  // Get the feature assignment with configuration
  const featureAssignment = await prisma.pricingTierFeature.findFirst({
    where: {
      feature: { featureKey },
      pricingTier: { tier: effectiveTier },
    },
    include: {
      feature: true,
      pricingTier: true,
    },
  });

  if (!featureAssignment || !featureAssignment.isEnabled) {
    return {
      hasAccess: false,
      currentUsage: 0,
      limit: 0,
      remaining: 0,
      period: 'daily',
      reason: 'Feature not available for this tier'
    };
  }

  // Determine time period from config or use override
  const configuredPeriod = featureAssignment.configValue?.timePeriod as 'daily' | 'monthly' | undefined;
  const period = overridePeriod || configuredPeriod || 'daily';
  
  const limit = featureAssignment.limitValue || 0;
  
  // -1 means unlimited
  if (limit === -1) {
    return {
      hasAccess: true,
      currentUsage: 0,
      limit: -1,
      remaining: -1,
      period
    };
  }

  // Get current usage based on feature type and period
  let currentUsage = 0;
  
  try {
    const startDate = new Date();
    if (period === 'daily') {
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    // Generic usage counting based on feature key patterns
    if (featureKey.includes('ai_chat') || featureKey.includes('chat_limit')) {
      currentUsage = await prisma.chatMessage.count({
        where: {
          clerkUserId: userId,
          role: 'USER',
          createdAt: { gte: startDate },
        },
      });
    } else if (featureKey.includes('article_generation')) {
      currentUsage = await prisma.aIInteraction.count({
        where: {
          clerkUserId: userId,
          interactionType: { typeName: 'article_generation' },
          startedAt: { gte: startDate },
          isSuccessful: true,
        },
      });
    } else if (featureKey.includes('example_questions') || featureKey.includes('generate_example')) {
      currentUsage = await prisma.aIInteraction.count({
        where: {
          clerkUserId: userId,
          interactionType: { typeName: 'interactive_examples' },
          startedAt: { gte: startDate },
          isSuccessful: true,
        },
      });
    } else if (featureKey.includes('download')) {
      // This would need to be tracked separately if downloads are implemented
      currentUsage = 0;
    } else {
      // For other features, we can't track usage without specific implementation
      currentUsage = 0;
    }
  } catch (error) {
    console.error('Error checking feature usage:', error);
    currentUsage = 0;
  }

  const remaining = Math.max(0, limit - currentUsage);
  const hasUsageAccess = limit === 0 ? false : currentUsage < limit;

  return {
    hasAccess: hasUsageAccess,
    currentUsage,
    limit,
    remaining,
    period,
    reason: hasUsageAccess ? undefined : `${period} limit reached (${currentUsage}/${limit})`
  };
}

/**
 * Legacy compatibility function - maps old permission checks to new feature system
 */
export async function checkSubscription(userId?: string | null) {
  const userAccess = await getUserFeatureAccess(userId);
  
  if (!userAccess) {
    return {
      tier: 'FREE',
      isActive: false,
      permissions: {
        canAccessArticles: false,
        canGenerateContent: false,
        canUseAIChat: false,
        canDownloadContent: false,
        canCreateCustomLists: false,
        canAccessAnalytics: false,
        canGetPrioritySupport: false,
        dailyAIChatsLimit: 0,
        monthlyDownloadsLimit: 0,
      },
    };
  }

  // Map new feature system to old permission interface
  const permissions = {
    canAccessArticles: userAccess.features.get('view_articles')?.hasAccess || false,
    canGenerateContent: userAccess.features.get('generate_article_content')?.hasAccess || false,
    canUseAIChat: userAccess.features.get('ai_chat')?.hasAccess || false,
    canDownloadContent: userAccess.features.get('monthly_download_limit')?.hasAccess || false,
    canCreateCustomLists: userAccess.features.get('manage_curated_lists')?.hasAccess || false,
    canAccessAnalytics: userAccess.features.get('view_article_analytics')?.hasAccess || false,
    canGetPrioritySupport: userAccess.features.get('priority_support')?.hasAccess || false,
    dailyAIChatsLimit: userAccess.features.get('daily_ai_chat_limit')?.limitValue || 0,
    monthlyDownloadsLimit: userAccess.features.get('monthly_download_limit')?.limitValue || 0,
  };

  return {
    tier: userAccess.tier,
    isActive: userAccess.isActive,
    permissions,
  };
}