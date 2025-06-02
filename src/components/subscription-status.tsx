'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSubscriptionCache } from '@/lib/cache-clear';

interface SubscriptionStatus {
  tier: string;
  status: string;
  isActive: boolean;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  hasStripeCustomer: boolean;
}

interface UsageInfo {
  hasAccess: boolean;
  currentUsage: number;
  limit: number;
  remaining: number;
  period: string;
}

interface UsageStats {
  dailyAIChats: UsageInfo;
  articleGeneration: UsageInfo;
  monthlyDownloads: UsageInfo;
}

export function SubscriptionStatus() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      // Clear ALL subscription cache aggressively
      clearSubscriptionCache();
      
      // Add cache-busting query parameter and headers to ensure fresh data
      const cacheBuster = `?t=${Date.now()}`;
      const response = await fetch(`/api/subscription/status${cacheBuster}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const data = await response.json();
      
      if (!response.ok && response.status === 404) {
        // User not found, try to sync from Clerk
        console.log('User not found in database, attempting to sync from Clerk...');
        const syncResponse = await fetch('/api/user/sync', {
          method: 'POST',
        });
        
        if (syncResponse.ok) {
          console.log('User synced successfully, fetching subscription status again...');
          // Try fetching subscription status again
          const retryCacheBuster = `?t=${Date.now()}`;
          const retryResponse = await fetch(`/api/subscription/status${retryCacheBuster}`);
          const retryData = await retryResponse.json();
          setSubscription(retryData);
          return;
        }
      }
      
      setSubscription(data);
      
      // Fetch usage statistics for non-free tiers
      if (data.tier !== 'FREE' && data.isActive) {
        await fetchUsageStats();
      }
    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageStats = async () => {
    try {
      const [dailyChats, articleGen, monthlyDownloads] = await Promise.all([
        fetch('/api/features/daily_ai_chat_limit/usage?period=daily').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/features/daily_article_generation_limit/usage?period=daily').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/features/monthly_download_limit/usage?period=monthly').then(r => r.ok ? r.json() : null).catch(() => null)
      ]);

      const defaultUsage = { hasAccess: false, currentUsage: 0, limit: 0, remaining: 0, period: 'daily' };

      setUsageStats({
        dailyAIChats: dailyChats?.usage || defaultUsage,
        articleGeneration: articleGen?.usage || { ...defaultUsage, period: 'daily' },
        monthlyDownloads: monthlyDownloads?.usage || { ...defaultUsage, period: 'monthly' }
      });
    } catch (error) {
      console.error('Failed to fetch usage stats:', error);
      const defaultUsage = { hasAccess: false, currentUsage: 0, limit: 0, remaining: 0, period: 'daily' };
      setUsageStats({
        dailyAIChats: defaultUsage,
        articleGeneration: defaultUsage,
        monthlyDownloads: { ...defaultUsage, period: 'monthly' }
      });
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to open customer portal:', error);
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  // For now, just display the tier name directly since we've made it dynamic
  const tierDisplayName = subscription.tier || 'Unknown';
  const periodEnd = subscription.currentPeriodEnd 
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short', 
        day: '2-digit'
      })
    : null;
  const cancelledAt = subscription.cancelledAt 
    ? new Date(subscription.cancelledAt).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      })
    : null;

  // Determine if subscription is cancelled but still active
  const isCancelledButActive = subscription.cancelledAt && subscription.isActive;

  // Helper function to format usage display
  const formatUsage = (usage: UsageInfo) => {
    if (!usage.hasAccess) return 'Not available';
    if (usage.limit === -1) return `${usage.currentUsage} (Unlimited)`;
    if (usage.limit === 0) return 'Not available';
    return `${usage.currentUsage} / ${usage.limit}`;
  };

  // Helper function to get usage color
  const getUsageColor = (usage: UsageInfo) => {
    if (!usage.hasAccess || usage.limit === -1 || usage.limit === 0) return 'text-gray-600';
    const percentage = (usage.currentUsage / usage.limit) * 100;
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Subscription Status</h3>
      
      <div className="space-y-4">
        <div>
          <span className="text-sm text-gray-600">Current Plan:</span>
          <p className="text-xl font-semibold">{tierDisplayName}</p>
        </div>

        {subscription.tier !== 'FREE' && (
          <>
            <div>
              <span className="text-sm text-gray-600">Status:</span>
              <div className="flex flex-col">
                <p className={`font-medium ${
                  subscription.isActive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isCancelledButActive ? 'Active (Cancelled)' : subscription.status}
                </p>
                {isCancelledButActive && (
                  <p className="text-sm text-orange-600 mt-1">
                    Plan cancelled on {cancelledAt}
                  </p>
                )}
              </div>
            </div>

            {(periodEnd || isCancelledButActive) && (
              <div>
                <span className="text-sm text-gray-600">
                  {isCancelledButActive ? 'Access expires on:' : 
                   subscription.status === 'CANCELLED' ? 'Access until:' : 'Renews on:'}
                </span>
                <p className="font-medium">
                  {periodEnd || (isCancelledButActive ? 'Contact support for details' : 'Unknown')}
                </p>
              </div>
            )}

            {isCancelledButActive && (
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                <p className="text-sm text-orange-800">
                  Your subscription has been cancelled and will not renew. 
                  {periodEnd ? (
                    <>You&apos;ll continue to have access to {tierDisplayName} features until {periodEnd}.</>
                  ) : (
                    <>Please contact support for information about your access period.</>
                  )}
                </p>
              </div>
            )}

            {/* Usage Statistics */}
            {subscription.isActive && usageStats && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Usage This Period</h4>
                <div className="space-y-2">
                  {(usageStats.dailyAIChats.hasAccess && usageStats.dailyAIChats.limit !== 0) && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Daily AI Chats:</span>
                      <span className={`text-sm font-medium ${
                        getUsageColor(usageStats.dailyAIChats)
                      }`}>
                        {formatUsage(usageStats.dailyAIChats)}
                      </span>
                    </div>
                  )}
                  {(usageStats.articleGeneration.hasAccess && usageStats.articleGeneration.limit !== 0) && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Daily Article Generation:</span>
                      <span className={`text-sm font-medium ${
                        getUsageColor(usageStats.articleGeneration)
                      }`}>
                        {formatUsage(usageStats.articleGeneration)}
                      </span>
                    </div>
                  )}
                  {(usageStats.monthlyDownloads.hasAccess && usageStats.monthlyDownloads.limit !== 0) && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Monthly Downloads:</span>
                      <span className={`text-sm font-medium ${
                        getUsageColor(usageStats.monthlyDownloads)
                      }`}>
                        {formatUsage(usageStats.monthlyDownloads)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div className="pt-4 space-y-2">
          {subscription.hasStripeCustomer && subscription.tier !== 'FREE' ? (
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="w-full bg-gray-800 text-white py-2 px-4 rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              {portalLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
          ) : (
            <button
              onClick={() => router.push('/pricing')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
            >
              Upgrade Plan
            </button>
          )}
          
          <button
            onClick={() => {
              setLoading(true);
              setUsageStats(null);
              fetchSubscriptionStatus();
            }}
            disabled={loading}
            className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 disabled:opacity-50 text-sm"
          >
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </button>
        </div>
      </div>
    </div>
  );
}