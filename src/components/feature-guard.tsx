"use client";

import { ReactNode } from 'react';
import { useFeatureAccess } from '@/hooks/use-feature-access';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface FeatureGuardProps {
  featureKey: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  upgradePromptText?: string;
  className?: string;
}

/**
 * Component that conditionally renders children based on feature access
 */
export function FeatureGuard({
  featureKey,
  children,
  fallback,
  showUpgradePrompt = false,
  upgradePromptText,
  className
}: FeatureGuardProps) {
  const { access, loading, error } = useFeatureAccess(featureKey);

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-200 rounded h-8 w-full ${className}`} />
    );
  }

  if (error) {
    return (
      <div className={`text-red-600 text-sm ${className}`}>
        Error checking feature access
      </div>
    );
  }

  if (!access?.hasAccess) {
    if (showUpgradePrompt) {
      return (
        <div className={`p-4 bg-orange-50 border border-orange-200 rounded-lg ${className}`}>
          <p className="text-orange-800 mb-3">
            {upgradePromptText || `This feature requires a subscription upgrade.`}
          </p>
          <Link href="/pricing">
            <Button variant="outline" size="sm" className="text-orange-700 border-orange-300 hover:bg-orange-100">
              View Pricing Plans
            </Button>
          </Link>
        </div>
      );
    }

    if (fallback) {
      return <div className={className}>{fallback}</div>;
    }

    return null;
  }

  return <div className={className}>{children}</div>;
}

interface FeatureUsageGuardProps {
  featureKey: string;
  period?: 'daily' | 'monthly';
  children: ReactNode;
  fallback?: ReactNode;
  showLimitWarning?: boolean;
  warningThreshold?: number; // Show warning when usage is above this percentage (0-1)
  className?: string;
}

/**
 * Component that conditionally renders children based on feature usage limits
 */
export function FeatureUsageGuard({
  featureKey,
  period = 'daily',
  children,
  fallback,
  showLimitWarning = false,
  warningThreshold = 0.8,
  className
}: FeatureUsageGuardProps) {
  const { access } = useFeatureAccess(featureKey);
  
  // Only check usage if the feature has access
  if (!access?.hasAccess) {
    return (
      <FeatureGuard
        featureKey={featureKey}
        fallback={fallback}
        showUpgradePrompt={true}
        className={className}
      >
        {children}
      </FeatureGuard>
    );
  }

  // For unlimited features (limit = -1), always show content
  if (access.limitValue === -1) {
    return <div className={className}>{children}</div>;
  }

  // If no limit is set, treat as unlimited
  if (!access.limitValue || access.limitValue === 0) {
    if (fallback) {
      return <div className={className}>{fallback}</div>;
    }
    return null;
  }

  return <UsageLimitChecker
    featureKey={featureKey}
    period={period}
    limit={access.limitValue}
    showLimitWarning={showLimitWarning}
    warningThreshold={warningThreshold}
    fallback={fallback}
    className={className}
  >
    {children}
  </UsageLimitChecker>;
}

interface UsageLimitCheckerProps {
  featureKey: string;
  period: 'daily' | 'monthly';
  limit: number;
  children: ReactNode;
  fallback?: ReactNode;
  showLimitWarning: boolean;
  warningThreshold: number;
  className?: string;
}

function UsageLimitChecker({
  featureKey,
  period,
  limit,
  children,
  fallback,
  showLimitWarning,
  warningThreshold,
  className
}: UsageLimitCheckerProps) {
  // This would need to fetch current usage - simplified for now
  // In practice, you'd use a hook like useFeatureUsage
  const currentUsage = 0; // Placeholder
  const usagePercentage = limit > 0 ? currentUsage / limit : 0;
  const hasUsageLeft = currentUsage < limit;

  if (!hasUsageLeft) {
    const limitMessage = `You've reached your ${period} limit of ${limit} for this feature.`;
    
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-red-800 mb-3">{limitMessage}</p>
        <Link href="/pricing">
          <Button variant="outline" size="sm" className="text-red-700 border-red-300 hover:bg-red-100">
            Upgrade for More
          </Button>
        </Link>
      </div>
    );
  }

  const content = (
    <div className={className}>
      {showLimitWarning && usagePercentage >= warningThreshold && (
        <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
          Warning: You've used {Math.round(usagePercentage * 100)}% of your {period} limit ({currentUsage}/{limit})
        </div>
      )}
      {children}
    </div>
  );

  return content;
}