"use client";

import { useState, useEffect } from "react";
import { Check, X, Edit2, Save, Plus, Trash2, Settings2 } from "lucide-react";
import Link from "next/link";

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
  isActive: boolean;
}

interface PricingTier {
  pricingId: string;
  tier: string;
  displayOrder: number;
  isActive: boolean;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
}

interface Assignment {
  id?: string;
  isEnabled: boolean;
  limitValue?: number | null;
  configValue?: any;
}

interface FeatureMatrix {
  feature: Feature;
  tierAssignments: Record<string, Assignment | null>;
}

interface OverviewData {
  pricingTiers: PricingTier[];
  allFeatures: Feature[];
  featureMatrix: FeatureMatrix[];
  tierSummaries: any[];
}

export default function FeatureAssignmentsPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<Assignment>({ isEnabled: false });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    fetchOverview();
  }, []);

  async function fetchOverview() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/pricing-tier-features/overview");
      if (!response.ok) throw new Error("Failed to fetch overview");
      
      const overviewData = await response.json();
      setData(overviewData);
    } catch (error) {
      console.error("Error fetching overview:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateAssignment(featureId: string, tierId: string, assignmentData: Assignment) {
    try {
      const existingAssignment = data?.featureMatrix
        .find(fm => fm.feature.featureId === featureId)
        ?.tierAssignments[getTierKey(tierId)];

      if (existingAssignment?.id) {
        // Update existing assignment
        const response = await fetch(`/api/admin/pricing-tier-features/${existingAssignment.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(assignmentData),
        });
        
        if (!response.ok) throw new Error("Failed to update assignment");
      } else {
        // Create new assignment
        const response = await fetch("/api/admin/pricing-tier-features", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pricingTierId: tierId,
            featureId: featureId,
            ...assignmentData,
          }),
        });
        
        if (!response.ok) throw new Error("Failed to create assignment");
      }
      
      await fetchOverview();
    } catch (error) {
      console.error("Error updating assignment:", error);
      alert("Failed to update assignment");
    }
  }

  async function deleteAssignment(assignmentId: string) {
    try {
      const response = await fetch(`/api/admin/pricing-tier-features/${assignmentId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error("Failed to delete assignment");
      
      await fetchOverview();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      alert("Failed to delete assignment");
    }
  }

  function getTierKey(tierId: string): string {
    return data?.pricingTiers.find(t => t.pricingId === tierId)?.tier || tierId;
  }

  function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function getCellId(featureId: string, tierId: string): string {
    return `${featureId}-${tierId}`;
  }

  function startEdit(featureId: string, tierId: string, assignment: Assignment | null) {
    const cellId = getCellId(featureId, tierId);
    setEditingCell(cellId);
    setEditValue(assignment || { 
      isEnabled: false, 
      limitValue: null,
      configValue: { timePeriod: 'daily' }
    });
  }

  function saveEdit(featureId: string, tierId: string) {
    updateAssignment(featureId, tierId, editValue);
    setEditingCell(null);
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditValue({ isEnabled: false, limitValue: null, configValue: { timePeriod: 'daily' } });
  }

  const categories = data ? Array.from(new Set(data.allFeatures.map(f => f.category.categoryKey))) : [];
  const categoryMap = data ? data.allFeatures.reduce((acc, f) => {
    acc[f.category.categoryKey] = f.category.categoryName;
    return acc;
  }, {} as Record<string, string>) : {};
  const filteredFeatures = data?.featureMatrix.filter(fm => 
    selectedCategory === "all" || fm.feature.category.categoryKey === selectedCategory
  ) || [];

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!data) {
    return <div className="text-center py-8">Failed to load data</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Feature Assignments</h1>
          <p className="mt-2 text-gray-600">
            Assign features to pricing tiers and configure their limits.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/features"
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Settings2 className="h-5 w-5" />
            Manage Features
          </Link>
        </div>
      </div>

      {/* Tier Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.tierSummaries.map((summary) => (
          <div key={summary.pricingId} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{summary.tier}</h3>
              {!summary.isActive && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {formatPrice(summary.monthlyPriceCents)}/mo
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {summary.enabledFeatures}/{summary.totalFeatures} features enabled
            </p>
          </div>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-3 py-1 rounded-md text-sm ${
            selectedCategory === "all" 
              ? "bg-orange-600 text-white" 
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          All Categories
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1 rounded-md text-sm ${
              selectedCategory === category 
                ? "bg-orange-600 text-white" 
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {categoryMap[category] || category.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Feature Assignment Matrix */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                  Feature
                </th>
                {data.pricingTiers.map((tier) => (
                  <th key={tier.pricingId} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div>
                      {tier.tier}
                      <div className="text-orange-600 font-semibold">
                        {formatPrice(tier.monthlyPriceCents)}/mo
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFeatures.map((featureMatrix) => {
                const feature = featureMatrix.feature;
                return (
                  <tr key={feature.featureId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-200">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{feature.featureName}</div>
                        <div className="text-sm text-gray-500">{feature.featureKey}</div>
                        <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded mt-1">
                          {feature.category.categoryName}
                        </span>
                      </div>
                    </td>
                    {data.pricingTiers.map((tier) => {
                      const assignment = featureMatrix.tierAssignments[tier.tier];
                      const cellId = getCellId(feature.featureId, tier.pricingId);
                      const isEditing = editingCell === cellId;
                      
                      return (
                        <td key={tier.pricingId} className={`px-6 py-4 text-center ${isEditing ? '' : 'whitespace-nowrap'}`}>
                          {isEditing ? (
                            <div className="min-w-0 max-w-28 mx-auto space-y-2">
                              <select
                                value={editValue.isEnabled ? "true" : "false"}
                                onChange={(e) => setEditValue({ ...editValue, isEnabled: e.target.value === "true" })}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1 min-w-0"
                              >
                                <option value="false">Disabled</option>
                                <option value="true">Enabled</option>
                              </select>
                              {editValue.isEnabled && feature.featureType === "NUMERIC_LIMIT" && (
                                <>
                                  <input
                                    type="number"
                                    value={editValue.limitValue || ""}
                                    onChange={(e) => setEditValue({ 
                                      ...editValue, 
                                      limitValue: e.target.value ? parseInt(e.target.value) : null 
                                    })}
                                    placeholder="Limit"
                                    className="w-full text-xs border border-gray-300 rounded px-2 py-1 min-w-0"
                                  />
                                  <select
                                    value={editValue.configValue?.timePeriod || 'daily'}
                                    onChange={(e) => setEditValue({ 
                                      ...editValue, 
                                      configValue: { ...editValue.configValue, timePeriod: e.target.value }
                                    })}
                                    className="w-full text-xs border border-gray-300 rounded px-2 py-1 min-w-0"
                                  >
                                    <option value="daily">Daily</option>
                                    <option value="monthly">Monthly</option>
                                  </select>
                                </>
                              )}
                              {editValue.isEnabled && feature.featureType === "CUSTOM" && (
                                <input
                                  type="number"
                                  value={editValue.limitValue || ""}
                                  onChange={(e) => setEditValue({ 
                                    ...editValue, 
                                    limitValue: e.target.value ? parseInt(e.target.value) : null 
                                  })}
                                  placeholder="Limit"
                                  className="w-full text-xs border border-gray-300 rounded px-2 py-1 min-w-0"
                                />
                              )}
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={() => saveEdit(feature.featureId, tier.pricingId)}
                                  className="p-1 text-green-600 hover:text-green-800"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1 text-gray-600 hover:text-gray-800"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {assignment ? (
                                <div className="flex items-center justify-center space-x-2">
                                  {assignment.isEnabled ? (
                                    <Check className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <X className="h-5 w-5 text-red-600" />
                                  )}
                                  <button
                                    onClick={() => startEdit(feature.featureId, tier.pricingId, assignment)}
                                    className="p-1 text-blue-600 hover:text-blue-800"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                  {assignment.id && (
                                    <button
                                      onClick={() => deleteAssignment(assignment.id!)}
                                      className="p-1 text-red-600 hover:text-red-800"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEdit(feature.featureId, tier.pricingId, null)}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              )}
                              {assignment?.isEnabled && assignment.limitValue !== null && assignment.limitValue !== undefined && (
                                <div className="text-xs text-gray-600">
                                  Limit: {assignment.limitValue === -1 ? "∞" : assignment.limitValue}
                                  {feature.featureType === "NUMERIC_LIMIT" && assignment.configValue?.timePeriod && (
                                    <div className="text-xs text-blue-600">
                                      {assignment.configValue.timePeriod}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredFeatures.length === 0 && (
        <div className="text-center py-8 text-gray-600">
          No features found for the selected category.
        </div>
      )}
    </div>
  );
}