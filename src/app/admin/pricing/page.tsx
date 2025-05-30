"use client";

import { useState, useEffect } from "react";
import { Edit2, Save, X, Plus, Trash2 } from "lucide-react";
import { SubscriptionTier } from "@prisma/client";

interface PricingData {
  pricingId: string;
  tier: SubscriptionTier;
  stripePriceId: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  features: string[];
  isActive: boolean;
}

export default function AdminPricingPage() {
  const [pricingData, setPricingData] = useState<PricingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PricingData>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [newForm, setNewForm] = useState<Partial<PricingData>>({
    tier: SubscriptionTier.STANDARD,
    stripePriceId: "",
    monthlyPriceCents: 0,
    yearlyPriceCents: 0,
    features: [],
    isActive: true,
  });

  useEffect(() => {
    fetchPricing();
  }, []);

  async function fetchPricing() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/pricing");
      if (!response.ok) throw new Error("Failed to fetch pricing");
      
      const data = await response.json();
      setPricingData(data.pricing);
    } catch (error) {
      console.error("Error fetching pricing:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(pricingId: string) {
    try {
      const response = await fetch(`/api/admin/pricing/${pricingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      
      if (!response.ok) throw new Error("Failed to update pricing");
      
      setEditingId(null);
      await fetchPricing();
    } catch (error) {
      console.error("Error updating pricing:", error);
      alert("Failed to update pricing");
    }
  }

  async function handleCreate() {
    try {
      const response = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      
      if (!response.ok) throw new Error("Failed to create pricing");
      
      setIsCreating(false);
      setNewForm({
        tier: SubscriptionTier.STANDARD,
        stripePriceId: "",
        monthlyPriceCents: 0,
        yearlyPriceCents: 0,
        features: [],
        isActive: true,
      });
      await fetchPricing();
    } catch (error) {
      console.error("Error creating pricing:", error);
      alert("Failed to create pricing");
    }
  }

  async function handleDelete(pricingId: string) {
    if (!confirm("Are you sure you want to delete this pricing tier?")) return;
    
    try {
      const response = await fetch(`/api/admin/pricing/${pricingId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error("Failed to delete pricing");
      
      await fetchPricing();
    } catch (error) {
      console.error("Error deleting pricing:", error);
      alert("Failed to delete pricing");
    }
  }

  function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subscription Pricing</h1>
          <p className="mt-2 text-gray-600">
            Manage subscription tiers and pricing
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Tier
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="space-y-6">
          {isCreating && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4">New Pricing Tier</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tier
                  </label>
                  <select
                    value={newForm.tier}
                    onChange={(e) => setNewForm({ ...newForm, tier: e.target.value as SubscriptionTier })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value={SubscriptionTier.FREE}>FREE</option>
                    <option value={SubscriptionTier.STANDARD}>STANDARD</option>
                    <option value={SubscriptionTier.MAX}>MAX</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stripe Price ID
                  </label>
                  <input
                    type="text"
                    value={newForm.stripePriceId}
                    onChange={(e) => setNewForm({ ...newForm, stripePriceId: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Price (cents)
                  </label>
                  <input
                    type="number"
                    value={newForm.monthlyPriceCents}
                    onChange={(e) => setNewForm({ ...newForm, monthlyPriceCents: parseInt(e.target.value) })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yearly Price (cents)
                  </label>
                  <input
                    type="number"
                    value={newForm.yearlyPriceCents}
                    onChange={(e) => setNewForm({ ...newForm, yearlyPriceCents: parseInt(e.target.value) })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Features (one per line)
                </label>
                <textarea
                  value={newForm.features?.join("\n")}
                  onChange={(e) => setNewForm({ ...newForm, features: e.target.value.split("\n").filter(f => f.trim()) })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  rows={4}
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {pricingData.map((pricing) => (
            <div
              key={pricing.pricingId}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              {editingId === pricing.pricingId ? (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stripe Price ID
                      </label>
                      <input
                        type="text"
                        value={editForm.stripePriceId}
                        onChange={(e) => setEditForm({ ...editForm, stripePriceId: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Active
                      </label>
                      <select
                        value={editForm.isActive ? "true" : "false"}
                        onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === "true" })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monthly Price (cents)
                      </label>
                      <input
                        type="number"
                        value={editForm.monthlyPriceCents}
                        onChange={(e) => setEditForm({ ...editForm, monthlyPriceCents: parseInt(e.target.value) })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Yearly Price (cents)
                      </label>
                      <input
                        type="number"
                        value={editForm.yearlyPriceCents}
                        onChange={(e) => setEditForm({ ...editForm, yearlyPriceCents: parseInt(e.target.value) })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Features (one per line)
                    </label>
                    <textarea
                      value={editForm.features?.join("\n")}
                      onChange={(e) => setEditForm({ ...editForm, features: e.target.value.split("\n").filter(f => f.trim()) })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                      rows={4}
                    />
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 text-gray-700 hover:text-gray-900"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleSave(pricing.pricingId)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      <Save className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{pricing.tier}</h3>
                        {!pricing.isActive && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-4">
                        Stripe Price ID: {pricing.stripePriceId}
                      </p>
                      <div className="flex gap-6 mb-4">
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatPrice(pricing.monthlyPriceCents)}
                          </p>
                          <p className="text-sm text-gray-500">per month</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatPrice(pricing.yearlyPriceCents)}
                          </p>
                          <p className="text-sm text-gray-500">per year</p>
                        </div>
                      </div>
                      <ul className="space-y-2">
                        {pricing.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span className="text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(pricing.pricingId);
                          setEditForm(pricing);
                        }}
                        className="p-2 text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(pricing.pricingId)}
                        className="p-2 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}