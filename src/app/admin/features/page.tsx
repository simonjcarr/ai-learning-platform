"use client";

import { useState, useEffect } from "react";
import { Edit2, Save, X, Plus, Trash2, Eye, Settings } from "lucide-react";
import Link from "next/link";

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
}

const FEATURE_CATEGORIES = [
  'CONTENT_MANAGEMENT',
  'SOCIAL_FEATURES', 
  'AI_FEATURES',
  'ORGANIZATION',
  'ANALYTICS',
  'ADMIN_TOOLS',
  'LIMITS'
];

const FEATURE_TYPES = [
  'BOOLEAN',
  'NUMERIC_LIMIT',
  'CUSTOM'
];

export default function AdminFeaturesPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Feature>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [newForm, setNewForm] = useState<Partial<Feature>>({
    featureKey: "",
    featureName: "",
    description: "",
    category: "CONTENT_MANAGEMENT",
    featureType: "BOOLEAN",
    isActive: true,
    defaultValue: { enabled: false },
  });

  useEffect(() => {
    fetchFeatures();
  }, []);

  async function fetchFeatures() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/features");
      if (!response.ok) throw new Error("Failed to fetch features");
      
      const data = await response.json();
      setFeatures(data.features);
    } catch (error) {
      console.error("Error fetching features:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(featureId: string) {
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
      
      setEditingId(null);
      await fetchFeatures();
    } catch (error) {
      console.error("Error updating feature:", error);
      alert("Failed to update feature");
    }
  }

  async function handleCreate() {
    if (!newForm.featureKey?.trim()) {
      alert("Feature key is required");
      return;
    }
    
    if (!newForm.featureName?.trim()) {
      alert("Feature name is required");
      return;
    }
    
    try {
      const response = await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to create feature");
        return;
      }
      
      setIsCreating(false);
      setNewForm({
        featureKey: "",
        featureName: "",
        description: "",
        category: "CONTENT_MANAGEMENT",
        featureType: "BOOLEAN",
        isActive: true,
        defaultValue: { enabled: false },
      });
      await fetchFeatures();
    } catch (error) {
      console.error("Error creating feature:", error);
      alert("Failed to create feature");
    }
  }

  async function handleDelete(featureId: string) {
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
      
      await fetchFeatures();
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

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Feature Management</h1>
          <p className="mt-2 text-gray-600">
            Manage application features and their configurations.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/feature-assignments"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Settings className="h-5 w-5" />
            Manage Assignments
          </Link>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add Feature
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="space-y-6">
          {isCreating && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4">New Feature</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Feature Key *
                  </label>
                  <input
                    type="text"
                    value={newForm.featureKey}
                    onChange={(e) => setNewForm({ ...newForm, featureKey: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="e.g., ai_chat, manage_lists"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Feature Name *
                  </label>
                  <input
                    type="text"
                    value={newForm.featureName}
                    onChange={(e) => setNewForm({ ...newForm, featureName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="e.g., AI Chat, Manage Lists"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newForm.category}
                    onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    {FEATURE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Feature Type
                  </label>
                  <select
                    value={newForm.featureType}
                    onChange={(e) => setNewForm({ ...newForm, featureType: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    {FEATURE_TYPES.map(type => (
                      <option key={type} value={type}>{type.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newForm.description}
                  onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  rows={3}
                  placeholder="Describe what this feature does..."
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

          {features.map((feature) => (
            <div
              key={feature.featureId}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              {editingId === feature.featureId ? (
                <div>
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
                        {FEATURE_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                        ))}
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
                        {FEATURE_TYPES.map(type => (
                          <option key={type} value={type}>{type.replace('_', ' ')}</option>
                        ))}
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
                  </div>
                  <div className="mt-4">
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
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 text-gray-700 hover:text-gray-900"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleSave(feature.featureId)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      <Save className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{feature.featureName}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(feature.category)}`}>
                          {feature.category.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(feature.featureType)}`}>
                          {feature.featureType.replace('_', ' ')}
                        </span>
                        {!feature.isActive && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-2">
                        Key: <code className="bg-gray-100 px-1 rounded">{feature.featureKey}</code>
                      </p>
                      {feature.description && (
                        <p className="text-gray-700 mb-4">{feature.description}</p>
                      )}
                      {feature.defaultValue && (
                        <div className="mb-4">
                          <span className="text-sm font-medium text-gray-700">Default Value:</span>
                          <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(feature.defaultValue, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/features/${feature.featureId}`}
                        className="p-2 text-blue-600 hover:text-blue-800"
                        title="View details"
                      >
                        <Eye className="h-5 w-5" />
                      </Link>
                      <button
                        onClick={() => {
                          setEditingId(feature.featureId);
                          setEditForm(feature);
                        }}
                        className="p-2 text-blue-600 hover:text-blue-800"
                        title="Edit feature"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(feature.featureId)}
                        className="p-2 text-red-600 hover:text-red-800"
                        title="Delete feature"
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