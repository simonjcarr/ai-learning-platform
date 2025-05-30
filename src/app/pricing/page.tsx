'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Check } from 'lucide-react';

interface PricingTier {
  pricingId: string;
  tier: string;
  stripePriceId: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  features: string[];
  isActive: boolean;
  freeTrialDays: number;
  displayOrder: number;
}

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(true);

  useEffect(() => {
    async function fetchPricing() {
      try {
        const response = await fetch('/api/pricing');
        if (response.ok) {
          const data = await response.json();
          setPricingTiers(data.pricing);
        }
      } catch (error) {
        console.error('Error fetching pricing:', error);
      } finally {
        setLoadingPricing(false);
      }
    }
    
    fetchPricing();
  }, []);

  const handleSubscribe = async (tier: string, priceId: string) => {
    if (!isSignedIn) {
      router.push('/sign-in?redirect_url=/pricing');
      return;
    }

    if (!priceId) {
      alert('Stripe is not fully configured. Please contact support.');
      console.error(`Price ID for ${tier} tier is not configured`);
      return;
    }

    setLoading(tier);

    try {
      const response = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          tier,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('API Error:', data);
        alert(`Error: ${data.error || 'Failed to create checkout session'}`);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No checkout URL returned', data);
        alert('Failed to create checkout session. Please try again.');
      }
    } catch (error) {
      console.error('Subscription error:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            Choose Your Learning Journey
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            Unlock your potential with our comprehensive IT learning platform
          </p>
        </div>

        {loadingPricing ? (
          <div className="mt-16 text-center">
            <div className="text-lg text-gray-600">Loading pricing...</div>
          </div>
        ) : (
          <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {pricingTiers.map((tier, index) => (
              <div
                key={tier.pricingId}
                className={`bg-white rounded-lg shadow-lg overflow-hidden ${
                  tier.tier.toUpperCase() === 'STANDARD' ? 'border-2 border-blue-500' : ''
                }`}
              >
                {tier.tier.toUpperCase() === 'STANDARD' && (
                  <div className="bg-blue-500 text-white text-center py-2 px-4">
                    <span className="text-sm font-semibold">MOST POPULAR</span>
                  </div>
                )}
                <div className="px-6 py-8">
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1).toLowerCase()}
                  </h3>
                  <p className="mt-4 text-gray-600">
                    {tier.tier.toUpperCase() === 'FREE' 
                      ? 'Perfect for getting started' 
                      : tier.tier.toUpperCase() === 'STANDARD' 
                      ? 'For serious learners' 
                      : 'Enhanced features and capabilities'}
                  </p>
                  <p className="mt-8">
                    <span className="text-4xl font-bold text-gray-900">
                      ${(tier.monthlyPriceCents / 100).toFixed(2)}
                    </span>
                    <span className="text-gray-600">/month</span>
                  </p>
                  {tier.freeTrialDays > 0 && (
                    <p className="mt-2 text-sm text-green-600">
                      {tier.freeTrialDays} day free trial
                    </p>
                  )}
                  <button
                    onClick={() => tier.tier.toUpperCase() !== 'FREE' ? handleSubscribe(tier.tier, tier.stripePriceId) : undefined}
                    disabled={loading !== null || tier.tier.toUpperCase() === 'FREE'}
                    className={`mt-8 w-full py-3 px-6 rounded-md font-medium ${
                      tier.tier.toUpperCase() === 'FREE'
                        ? 'bg-gray-200 text-gray-800 cursor-not-allowed'
                        : tier.tier.toUpperCase() === 'STANDARD'
                        ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                        : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {tier.tier.toUpperCase() === 'FREE'
                      ? 'Current Plan'
                      : loading === tier.tier
                      ? 'Loading...'
                      : 'Subscribe'}
                  </button>
                </div>
                <div className="px-6 pb-8">
                  <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    What&apos;s included
                  </h4>
                  <ul className="mt-4 space-y-3">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="ml-3 text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-gray-600">
            {pricingTiers.some(tier => tier.freeTrialDays > 0) 
              ? `Free trials available. Cancel anytime.`
              : 'All plans include flexible billing. Cancel anytime.'}
          </p>
        </div>
      </div>
    </div>
  );
}