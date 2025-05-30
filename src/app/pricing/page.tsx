'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Check } from 'lucide-react';
import { SUBSCRIPTION_TIERS } from '@/lib/stripe';

// You'll need to create these price IDs in your Stripe dashboard
const PRICE_IDS = {
  STANDARD: process.env.NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID || '',
  MAX: process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID || '',
};

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (tier: 'STANDARD' | 'MAX') => {
    if (!isSignedIn) {
      router.push('/sign-in?redirect_url=/pricing');
      return;
    }

    const priceId = PRICE_IDS[tier];
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

        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Free Tier */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-8">
              <h3 className="text-2xl font-semibold text-gray-900">
                {SUBSCRIPTION_TIERS.FREE.name}
              </h3>
              <p className="mt-4 text-gray-600">Perfect for getting started</p>
              <p className="mt-8">
                <span className="text-4xl font-bold text-gray-900">$0</span>
                <span className="text-gray-600">/month</span>
              </p>
              <button
                className="mt-8 w-full bg-gray-200 text-gray-800 py-3 px-6 rounded-md font-medium cursor-not-allowed"
                disabled
              >
                Current Plan
              </button>
            </div>
            <div className="px-6 pb-8">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                What&apos;s included
              </h4>
              <ul className="mt-4 space-y-3">
                {SUBSCRIPTION_TIERS.FREE.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="ml-3 text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Standard Tier */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-blue-500">
            <div className="bg-blue-500 text-white text-center py-2 px-4">
              <span className="text-sm font-semibold">MOST POPULAR</span>
            </div>
            <div className="px-6 py-8">
              <h3 className="text-2xl font-semibold text-gray-900">
                {SUBSCRIPTION_TIERS.STANDARD.name}
              </h3>
              <p className="mt-4 text-gray-600">For serious learners</p>
              <p className="mt-8">
                <span className="text-4xl font-bold text-gray-900">
                  ${SUBSCRIPTION_TIERS.STANDARD.price}
                </span>
                <span className="text-gray-600">/month</span>
              </p>
              <button
                onClick={() => handleSubscribe('STANDARD')}
                disabled={loading !== null}
                className="mt-8 w-full bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === 'STANDARD' ? 'Loading...' : 'Subscribe'}
              </button>
            </div>
            <div className="px-6 pb-8">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                What&apos;s included
              </h4>
              <ul className="mt-4 space-y-3">
                {SUBSCRIPTION_TIERS.STANDARD.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="ml-3 text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Max Tier */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-8">
              <h3 className="text-2xl font-semibold text-gray-900">
                {SUBSCRIPTION_TIERS.MAX.name}
              </h3>
              <p className="mt-4 text-gray-600">Maximum learning power</p>
              <p className="mt-8">
                <span className="text-4xl font-bold text-gray-900">
                  ${SUBSCRIPTION_TIERS.MAX.price}
                </span>
                <span className="text-gray-600">/month</span>
              </p>
              <button
                onClick={() => handleSubscribe('MAX')}
                disabled={loading !== null}
                className="mt-8 w-full bg-gray-900 text-white py-3 px-6 rounded-md font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === 'MAX' ? 'Loading...' : 'Subscribe'}
              </button>
            </div>
            <div className="px-6 pb-8">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                What&apos;s included
              </h4>
              <ul className="mt-4 space-y-3">
                {SUBSCRIPTION_TIERS.MAX.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="ml-3 text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600">
            All plans include a 7-day free trial. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}