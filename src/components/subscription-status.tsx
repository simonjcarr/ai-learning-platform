'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// Dynamic tiers will be fetched from the API

interface SubscriptionStatus {
  tier: string;
  status: string;
  isActive: boolean;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
}

export function SubscriptionStatus() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/subscription/status');
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
          const retryResponse = await fetch('/api/subscription/status');
          const retryData = await retryResponse.json();
          setSubscription(retryData);
          return;
        }
      }
      
      setSubscription(data);
    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
    } finally {
      setLoading(false);
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
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Subscription Status</h3>
      
      <div className="space-y-3">
        <div>
          <span className="text-sm text-gray-600">Current Plan:</span>
          <p className="text-xl font-semibold">{tierDisplayName}</p>
        </div>

        {subscription.tier !== 'FREE' && (
          <>
            <div>
              <span className="text-sm text-gray-600">Status:</span>
              <p className={`font-medium ${
                subscription.isActive ? 'text-green-600' : 'text-red-600'
              }`}>
                {subscription.status}
              </p>
            </div>

            {periodEnd && (
              <div>
                <span className="text-sm text-gray-600">
                  {subscription.status === 'CANCELLED' ? 'Access until:' : 'Renews on:'}
                </span>
                <p className="font-medium">{periodEnd}</p>
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
        </div>
      </div>
    </div>
  );
}