'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Check, X, Star } from 'lucide-react';

interface FeatureAssignment {
  featureKey: string;
  featureName: string;
  featureType: string;
  category: {
    categoryKey: string;
    categoryName: string;
  };
  isEnabled: boolean;
  limitValue?: number | null;
  configValue?: any;
}

interface PricingTier {
  pricingId: string;
  tier: string;
  stripePriceId: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  isActive: boolean;
  freeTrialDays: number;
  displayOrder: number;
  featureAssignments: FeatureAssignment[];
}

interface Feature {
  featureId: string;
  featureKey: string;
  featureName: string;
  description?: string;
  category: {
    categoryKey: string;
    categoryName: string;
  };
  featureType: string;
}

interface PricingData {
  pricing: PricingTier[];
  allFeatures: Feature[];
}

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(true);

  useEffect(() => {
    async function fetchPricing() {
      try {
        const response = await fetch('/api/pricing');
        if (response.ok) {
          const data = await response.json();
          setPricingData(data);
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

  const getFeatureForTier = (featureKey: string, tier: PricingTier): FeatureAssignment | null => {
    return tier.featureAssignments.find(assignment => assignment.featureKey === featureKey) || null;
  };

  const formatFeatureValue = (assignment: FeatureAssignment | null): string => {
    if (!assignment || !assignment.isEnabled) return '';
    
    if (assignment.featureType === 'BOOLEAN') {
      return '✓';
    }
    
    if (assignment.featureType === 'NUMERIC_LIMIT' && assignment.limitValue !== null) {
      const limit = assignment.limitValue === -1 ? 'Unlimited' : assignment.limitValue.toString();
      const period = assignment.configValue?.timePeriod || 'daily';
      return `${limit} ${period}`;
    }
    
    return '✓';
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'CONTENT_MANAGEMENT': 'bg-blue-50 text-blue-800',
      'SOCIAL_FEATURES': 'bg-green-50 text-green-800',
      'AI_FEATURES': 'bg-purple-50 text-purple-800',
      'ORGANIZATION': 'bg-yellow-50 text-yellow-800',
      'ANALYTICS': 'bg-indigo-50 text-indigo-800',
      'LIMITS': 'bg-gray-50 text-gray-800',
    };
    return colors[category] || 'bg-gray-50 text-gray-800';
  };

  if (loadingPricing) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-lg text-gray-600">Loading pricing...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!pricingData) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-lg text-gray-600">Failed to load pricing information.</div>
          </div>
        </div>
      </div>
    );
  }

  // Group features by category
  const featuresByCategory = pricingData.allFeatures.reduce((acc, feature) => {
    const categoryKey = feature.category.categoryKey;
    if (!acc[categoryKey]) {
      acc[categoryKey] = {
        categoryName: feature.category.categoryName,
        features: []
      };
    }
    acc[categoryKey].features.push(feature);
    return acc;
  }, {} as Record<string, { categoryName: string; features: Feature[] }>);

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

        {/* Mobile Pricing Cards */}
        <div className="mt-16 lg:hidden">
          <div className="space-y-8">
            {pricingData.pricing.map((tier) => (
              <div
                key={tier.pricingId}
                className={`bg-white rounded-lg shadow-sm overflow-hidden ${
                  tier.tier.toUpperCase() === 'STANDARD' ? 'border-2 border-blue-500' : 'border border-gray-200'
                }`}
              >
                {/* Mobile tier header */}
                <div className="relative">
                  {tier.tier.toUpperCase() === 'STANDARD' && (
                    <div className="bg-blue-500 text-white text-center py-2 px-4">
                      <span className="text-sm font-semibold flex items-center justify-center gap-1">
                        <Star className="h-4 w-4" />
                        MOST POPULAR
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="p-6">
                  <div className="text-center">
                    <h3 className="text-2xl font-semibold text-gray-900">
                      {tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1).toLowerCase()}
                    </h3>
                    <p className="mt-2 text-gray-600">
                      {tier.tier.toUpperCase() === 'FREE' 
                        ? 'Perfect for getting started' 
                        : tier.tier.toUpperCase() === 'STANDARD' 
                        ? 'For serious learners' 
                        : 'Enhanced features and capabilities'}
                    </p>
                    
                    <div className="mt-4">
                      <p>
                        <span className="text-4xl font-bold text-gray-900">
                          ${(tier.monthlyPriceCents / 100).toFixed(2)}
                        </span>
                        <span className="text-gray-600">/month</span>
                      </p>
                      
                      {tier.freeTrialDays > 0 && (
                        <p className="text-sm text-green-600 mt-2">
                          {tier.freeTrialDays} day free trial
                        </p>
                      )}
                    </div>
                    
                    <button
                      onClick={() => tier.tier.toUpperCase() !== 'FREE' ? handleSubscribe(tier.tier, tier.stripePriceId) : undefined}
                      disabled={loading !== null || tier.tier.toUpperCase() === 'FREE'}
                      className={`mt-6 w-full py-3 px-6 rounded-md font-medium ${
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
                  
                  {/* Mobile feature list */}
                  <div className="mt-8">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Features included:</h4>
                    {Object.entries(featuresByCategory).map(([categoryKey, categoryData]) => (
                      <div key={categoryKey} className="mb-6">
                        <h5 className={`text-sm font-medium mb-3 px-3 py-1 rounded-full inline-block ${getCategoryColor(categoryKey)}`}>
                          {categoryData.categoryName}
                        </h5>
                        <div className="space-y-2">
                          {categoryData.features.map((feature) => {
                            const assignment = getFeatureForTier(feature.featureKey, tier);
                            const value = formatFeatureValue(assignment);
                            
                            return (
                              <div key={feature.featureKey} className="flex items-center justify-between py-2">
                                <div>
                                  <div className="font-medium text-gray-900">{feature.featureName}</div>
                                  {feature.description && (
                                    <div className="text-sm text-gray-500">{feature.description}</div>
                                  )}
                                </div>
                                <div className="ml-4 flex-shrink-0">
                                  {assignment && assignment.isEnabled ? (
                                    <div className="flex items-center">
                                      {assignment.featureType === 'BOOLEAN' ? (
                                        <Check className="h-5 w-5 text-green-600" />
                                      ) : (
                                        <span className="text-sm font-medium text-gray-900 bg-green-50 px-2 py-1 rounded">
                                          {value}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <X className="h-5 w-5 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Pricing Table */}
        <div className="mt-16 hidden lg:block">
          <div className="overflow-x-auto">
            <div className={`grid gap-6 items-stretch`} style={{ 
              gridTemplateColumns: `300px repeat(${pricingData.pricing.length}, minmax(250px, 1fr))`,
              minWidth: `${300 + (pricingData.pricing.length * 250)}px`
            }}>
            {/* Feature column header */}
            <div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex flex-col justify-center">
                <h3 className="text-lg font-semibold text-gray-900">Features</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Compare what's included in each plan
                </p>
              </div>
            </div>

            {/* Pricing tier cards */}
            {pricingData.pricing.map((tier) => (
              <div
                key={tier.pricingId}
                className={`bg-white rounded-lg shadow-sm overflow-hidden flex flex-col ${
                  tier.tier.toUpperCase() === 'STANDARD' ? 'border-2 border-blue-500' : 'border border-gray-200'
                }`}
              >
                {/* Fixed height header area to ensure alignment */}
                <div className="h-10 flex items-center justify-center">
                  {tier.tier.toUpperCase() === 'STANDARD' && (
                    <div className="bg-blue-500 text-white text-center py-2 px-4 w-full">
                      <span className="text-sm font-semibold flex items-center justify-center gap-1">
                        <Star className="h-4 w-4" />
                        MOST POPULAR
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="p-6 flex flex-col h-full">
                  <div className="flex-grow">
                    <h3 className="text-2xl font-semibold text-gray-900">
                      {tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1).toLowerCase()}
                    </h3>
                    <p className="mt-2 text-gray-600">
                      {tier.tier.toUpperCase() === 'FREE' 
                        ? 'Perfect for getting started' 
                        : tier.tier.toUpperCase() === 'STANDARD' 
                        ? 'For serious learners' 
                        : 'Enhanced features and capabilities'}
                    </p>
                  </div>
                  
                  <div className="mt-6">
                    <p>
                      <span className="text-4xl font-bold text-gray-900">
                        ${(tier.monthlyPriceCents / 100).toFixed(2)}
                      </span>
                      <span className="text-gray-600">/month</span>
                    </p>
                    
                    {/* Fixed height container for free trial text to ensure alignment */}
                    <div className="h-6 mt-2">
                      {tier.freeTrialDays > 0 && (
                        <p className="text-sm text-green-600">
                          {tier.freeTrialDays} day free trial
                        </p>
                      )}
                    </div>
                    
                    <button
                      onClick={() => tier.tier.toUpperCase() !== 'FREE' ? handleSubscribe(tier.tier, tier.stripePriceId) : undefined}
                      disabled={loading !== null || tier.tier.toUpperCase() === 'FREE'}
                      className={`mt-6 w-full py-3 px-6 rounded-md font-medium ${
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
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>

        {/* Feature Comparison Matrix - Desktop Only */}
        <div className="mt-8 hidden lg:block">
          <div className="overflow-x-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" style={{
              minWidth: `${300 + (pricingData.pricing.length * 250)}px`
            }}>
            {Object.entries(featuresByCategory).map(([categoryKey, categoryData]) => (
              <div key={categoryKey} className="border-b border-gray-200 last:border-b-0">
                {/* Category Header */}
                <div className="bg-gray-50 px-6 py-4">
                  <div className={`grid gap-6`} style={{ 
                    gridTemplateColumns: `300px repeat(${pricingData.pricing.length}, minmax(250px, 1fr))` 
                  }}>
                    <div>
                      <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${getCategoryColor(categoryKey)}`}>
                        {categoryData.categoryName}
                      </span>
                    </div>
                    {/* Empty columns for tier headers */}
                    {pricingData.pricing.map((tier) => (
                      <div key={tier.pricingId}></div>
                    ))}
                  </div>
                </div>

                {/* Features in this category */}
                {categoryData.features.map((feature) => (
                  <div key={feature.featureKey} className="px-6 py-4 border-b border-gray-100 last:border-b-0">
                    <div className={`grid gap-6 items-center`} style={{ 
                      gridTemplateColumns: `300px repeat(${pricingData.pricing.length}, minmax(250px, 1fr))` 
                    }}>
                      {/* Feature name */}
                      <div>
                        <div className="font-medium text-gray-900">{feature.featureName}</div>
                        {feature.description && (
                          <div className="text-sm text-gray-500 mt-1">{feature.description}</div>
                        )}
                      </div>

                      {/* Feature availability for each tier */}
                      {pricingData.pricing.map((tier) => {
                        const assignment = getFeatureForTier(feature.featureKey, tier);
                        const value = formatFeatureValue(assignment);
                        
                        return (
                          <div key={tier.pricingId} className="text-center">
                            {assignment && assignment.isEnabled ? (
                              <div className="flex items-center justify-center">
                                {assignment.featureType === 'BOOLEAN' ? (
                                  <Check className="h-5 w-5 text-green-600" />
                                ) : (
                                  <span className="text-sm font-medium text-gray-900">{value}</span>
                                )}
                              </div>
                            ) : (
                              <X className="h-5 w-5 text-gray-400 mx-auto" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600">
            {pricingData.pricing.some(tier => tier.freeTrialDays > 0) 
              ? `Free trials available. Cancel anytime.`
              : 'All plans include flexible billing. Cancel anytime.'}
          </p>
        </div>
      </div>
    </div>
  );
}