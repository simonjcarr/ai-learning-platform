import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

export interface FeatureAccess {
  hasAccess: boolean;
  limitValue?: number | null;
  configValue?: any;
  reason?: string;
}

export interface FeatureUsage {
  hasAccess: boolean;
  currentUsage: number;
  limit: number;
  remaining: number;
  reason?: string;
}

/**
 * Hook to check if user has access to a specific feature
 */
export function useFeatureAccess(featureKey: string) {
  const { userId, isLoaded } = useAuth();
  const [access, setAccess] = useState<FeatureAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const checkAccess = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/features/${featureKey}/check`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to check feature access');
        }

        const data = await response.json();
        setAccess(data.access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check feature access');
        setAccess({ hasAccess: false, reason: 'Error checking access' });
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [featureKey, userId, isLoaded]);

  return { access, loading, error, refetch: () => setLoading(true) };
}

/**
 * Hook to check feature usage limits
 */
export function useFeatureUsage(featureKey: string, period: 'daily' | 'monthly' = 'daily') {
  const { userId, isLoaded } = useAuth();
  const [usage, setUsage] = useState<FeatureUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const checkUsage = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/features/${featureKey}/usage?period=${period}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to check feature usage');
        }

        const data = await response.json();
        setUsage(data.usage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check feature usage');
        setUsage({ hasAccess: false, currentUsage: 0, limit: 0, remaining: 0, reason: 'Error checking usage' });
      } finally {
        setLoading(false);
      }
    };

    checkUsage();
  }, [featureKey, period, userId, isLoaded]);

  return { usage, loading, error, refetch: () => setLoading(true) };
}

/**
 * Hook to get all feature access for the current user
 */
export function useUserFeatures() {
  const { userId, isLoaded } = useAuth();
  const [features, setFeatures] = useState<Map<string, FeatureAccess> | null>(null);
  const [tier, setTier] = useState<string>('FREE');
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const fetchFeatures = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/user/features', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user features');
        }

        const data = await response.json();
        
        // Convert plain object back to Map
        const featureMap = new Map<string, FeatureAccess>();
        Object.entries(data.features || {}).forEach(([key, value]) => {
          featureMap.set(key, value as FeatureAccess);
        });
        
        setFeatures(featureMap);
        setTier(data.tier || 'FREE');
        setIsActive(data.isActive || false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch user features');
        setFeatures(new Map());
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, [userId, isLoaded]);

  const hasFeature = (featureKey: string): boolean => {
    return features?.get(featureKey)?.hasAccess || false;
  };

  const getFeatureLimit = (featureKey: string): number => {
    return features?.get(featureKey)?.limitValue || 0;
  };

  const getFeatureConfig = (featureKey: string): any => {
    return features?.get(featureKey)?.configValue;
  };

  return {
    features,
    tier,
    isActive,
    loading,
    error,
    hasFeature,
    getFeatureLimit,
    getFeatureConfig,
    refetch: () => setLoading(true)
  };
}