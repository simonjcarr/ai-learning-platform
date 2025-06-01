"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Edit2, Save, X, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Feature {
  featureId: string;
  featureKey: string;
  featureName: string;
  description?: string;
  category: string;
  featureType: string;
  isActive: boolean;
  defaultValue?: any;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  pricingTierFeatures: Array<{
    id: string;
    isEnabled: boolean;
    limitValue?: number;
    configValue?: any;
    pricingTier: {
      pricingId: string;
      tier: string;
      displayOrder: number;
      monthlyPriceCents: number;
    };
  }>;
}

export default function FeatureDetailPage() {
  const params = useParams();
  const featureId = params.featureId as string;
  
  const [feature, setFeature] = useState<Feature | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Feature>>({});

  useEffect(() => {
    if (featureId) {
      fetchFeature();
    }
  }, [featureId]);

  async function fetchFeature() {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/features/${featureId}`);
      if (!response.ok) throw new Error("Failed to fetch feature");
      
      const data = await response.json();
      setFeature(data.feature);
      setEditForm(data.feature);
    } catch (error) {
      console.error("Error fetching feature:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editForm.featureName?.trim()) {
      alert("Feature name is required");
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/features/${featureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to update feature");
        return;
      }
      
      setIsEditing(false);
      await fetchFeature();
    } catch (error) {
      console.error("Error updating feature:", error);
      alert("Failed to update feature");
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this feature?")) return;
    
    try {
      const response = await fetch(`/api/admin/features/${featureId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const data = await response.json();
        if (data.assignedTiers) {
          alert(`Cannot delete: Feature is assigned to ${data.assignedTiers} pricing tier(s). ${data.suggestion}`);
        } else {
          alert("Failed to delete feature");
        }
        return;
      }
      
      // Redirect to features list after successful deletion
      window.location.href = "/admin/features";
    } catch (error) {
      console.error("Error deleting feature:", error);
      alert("Failed to delete feature");
    }
  }

  function getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      'CONTENT_MANAGEMENT': 'bg-blue-100 text-blue-800',
      'SOCIAL_FEATURES': 'bg-green-100 text-green-800',
      'AI_FEATURES': 'bg-purple-100 text-purple-800',
      'ORGANIZATION': 'bg-yellow-100 text-yellow-800',
      'ANALYTICS': 'bg-indigo-100 text-indigo-800',
      'ADMIN_TOOLS': 'bg-red-100 text-red-800',
      'LIMITS': 'bg-gray-100 text-gray-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  }

  function getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      'BOOLEAN': 'bg-emerald-100 text-emerald-800',
      'NUMERIC_LIMIT': 'bg-orange-100 text-orange-800',
      'CUSTOM': 'bg-pink-100 text-pink-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  }

  function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!feature) {
    return <div className="text-center py-8">Feature not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/features"
            className="p-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{feature.featureName}</h1>
            <p className="text-gray-600">Feature details and assignments</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feature Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Feature Information</h2>
        
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feature Key
              </label>
              <input
                type="text"
                value={editForm.featureKey}
                onChange={(e) => setEditForm({ ...editForm, featureKey: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feature Name
              </label>
              <input
                type="text"
                value={editForm.featureName}
                onChange={(e) => setEditForm({ ...editForm, featureName: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="CONTENT_MANAGEMENT">Content Management</option>
                <option value="SOCIAL_FEATURES">Social Features</option>
                <option value="AI_FEATURES">AI Features</option>
                <option value="ORGANIZATION">Organization</option>
                <option value="ANALYTICS">Analytics</option>
                <option value="ADMIN_TOOLS">Admin Tools</option>
                <option value="LIMITS">Limits</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feature Type
              </label>
              <select
                value={editForm.featureType}
                onChange={(e) => setEditForm({ ...editForm, featureType: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="BOOLEAN">Boolean</option>
                <option value="NUMERIC_LIMIT">Numeric Limit</option>
                <option value="CUSTOM">Custom</option>
              </select>
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
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-700">Feature Key:</span>
                <p className="mt-1">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">{feature.featureKey}</code>
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Feature Name:</span>
                <p className="mt-1 text-gray-900">{feature.featureName}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Category:</span>
                <p className="mt-1">
                  <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(feature.category)}`}>
                    {feature.category.replace('_', ' ')}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Type:</span>
                <p className="mt-1">
                  <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(feature.featureType)}`}>
                    {feature.featureType.replace('_', ' ')}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Status:</span>
                <p className="mt-1">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    feature.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {feature.isActive ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
            </div>
            
            {feature.description && (
              <div>
                <span className="text-sm font-medium text-gray-700">Description:</span>
                <p className="mt-1 text-gray-900">{feature.description}</p>
              </div>
            )}
            
            {feature.defaultValue && (
              <div>
                <span className="text-sm font-medium text-gray-700">Default Value:</span>
                <pre className="mt-1 bg-gray-50 p-3 rounded text-sm overflow-x-auto">
                  {JSON.stringify(feature.defaultValue, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pricing Tier Assignments */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Pricing Tier Assignments</h2>
          <Link
            href="/admin/feature-assignments"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Manage All Assignments →
          </Link>
        </div>
        
        {feature.pricingTierFeatures.length > 0 ? (
          <div className="space-y-3">
            {feature.pricingTierFeatures
              .sort((a, b) => a.pricingTier.displayOrder - b.pricingTier.displayOrder)
              .map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="font-medium text-gray-900">{assignment.pricingTier.tier}</h3>
                      <p className="text-sm text-gray-600">
                        {formatPrice(assignment.pricingTier.monthlyPriceCents)}/month
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {assignment.isEnabled ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Enabled
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          Disabled
                        </span>
                      )}
                      {assignment.limitValue !== null && assignment.limitValue !== undefined && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          Limit: {assignment.limitValue === -1 ? '∞' : assignment.limitValue}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600">
            <p>This feature is not assigned to any pricing tiers yet.</p>
            <Link
              href="/admin/feature-assignments"
              className="mt-2 inline-block text-blue-600 hover:text-blue-800"
            >
              Assign to Pricing Tiers →
            </Link>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Metadata</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Created:</span>
            <p className="text-gray-900">{new Date(feature.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Last Updated:</span>
            <p className="text-gray-900">{new Date(feature.updatedAt).toLocaleString()}</p>
          </div>
        </div>
        
        {feature.metadata && (
          <div className="mt-4">
            <span className="font-medium text-gray-700">Additional Metadata:</span>
            <pre className="mt-1 bg-gray-50 p-3 rounded text-sm overflow-x-auto">
              {JSON.stringify(feature.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}