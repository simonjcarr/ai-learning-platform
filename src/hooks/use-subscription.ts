"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { SubscriptionTier } from "@prisma/client";

interface SubscriptionStatus {
  tier: SubscriptionTier;
  isActive: boolean;
  canGenerateContent: boolean;
  canUseAIChat: boolean;
  canDownloadContent: boolean;
  canCreateCustomLists: boolean;
}

export function useSubscription() {
  const { user, isSignedIn, isLoaded } = useUser();
  
  const getCachedSubscription = () => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('userSubscription');
      return cached ? JSON.parse(cached) as SubscriptionStatus : null;
    }
    return null;
  };
  
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(getCachedSubscription);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(() => {
    const cached = getCachedSubscription();
    return !cached || !isLoaded || !isSignedIn;
  });

  useEffect(() => {
    async function fetchSubscriptionStatus() {
      if (!isLoaded) {
        return;
      }
      
      if (!isSignedIn || !user) {
        const freeSubscription: SubscriptionStatus = {
          tier: 'FREE',
          isActive: false,
          canGenerateContent: false,
          canUseAIChat: false,
          canDownloadContent: false,
          canCreateCustomLists: false,
        };
        setSubscription(freeSubscription);
        setIsLoadingSubscription(false);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('userSubscription');
        }
        return;
      }

      try {
        const response = await fetch("/api/subscription/status");
        if (response.ok) {
          const data = await response.json();
          const subscriptionStatus: SubscriptionStatus = {
            tier: data.tier,
            isActive: data.isActive,
            canGenerateContent: data.permissions.canGenerateContent,
            canUseAIChat: data.permissions.canUseAIChat,
            canDownloadContent: data.permissions.canDownloadContent,
            canCreateCustomLists: data.permissions.canCreateCustomLists,
          };
          setSubscription(subscriptionStatus);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('userSubscription', JSON.stringify(subscriptionStatus));
          }
        } else {
          const freeSubscription: SubscriptionStatus = {
            tier: 'FREE',
            isActive: false,
            canGenerateContent: false,
            canUseAIChat: false,
            canDownloadContent: false,
            canCreateCustomLists: false,
          };
          setSubscription(freeSubscription);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('userSubscription', JSON.stringify(freeSubscription));
          }
        }
      } catch (error) {
        console.error("Failed to fetch subscription status:", error);
        const freeSubscription: SubscriptionStatus = {
          tier: 'FREE',
          isActive: false,
          canGenerateContent: false,
          canUseAIChat: false,
          canDownloadContent: false,
          canCreateCustomLists: false,
        };
        setSubscription(freeSubscription);
      } finally {
        setIsLoadingSubscription(false);
      }
    }

    fetchSubscriptionStatus();
  }, [user, isSignedIn, isLoaded]);

  const isSubscribed = subscription?.isActive && subscription?.tier !== 'FREE';

  return {
    subscription,
    isLoadingSubscription,
    isSubscribed,
  };
}