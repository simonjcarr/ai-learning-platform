"use client";

import { useState, useEffect } from "react";
import { Edit2, Save, X, Plus, Trash2, Eye, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";

interface FeatureCategory {
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  _count: {
    features: number;
  };
}

export default function AdminFeatureCategoriesPage() {
  const [categories, setCategories] = useState<FeatureCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FeatureCategory>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [newForm, setNewForm] = useState<Partial<FeatureCategory>>({
    categoryKey: "",
    categoryName: "",
    description: "",
    displayOrder: 1,
    isActive: true,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/feature-categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      
      const data = await response.json();
      setCategories(data.categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(categoryId: string) {
    if (!editForm.categoryName?.trim()) {
      alert("Category name is required");
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/feature-categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to update category");
        return;
      }
      
      setEditingId(null);
      await fetchCategories();
    } catch (error) {
      console.error("Error updating category:", error);
      alert("Failed to update category");
    }
  }

  async function handleCreate() {
    if (!newForm.categoryKey?.trim()) {
      alert("Category key is required");
      return;
    }
    
    if (!newForm.categoryName?.trim()) {
      alert("Category name is required");
      return;
    }
    
    try {
      const response = await fetch("/api/admin/feature-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to create category");
        return;
      }
      
      setIsCreating(false);
      setNewForm({
        categoryKey: "",
        categoryName: "",
        description: "",
        displayOrder: 1,
        isActive: true,
      });
      await fetchCategories();
    } catch (error) {
      console.error("Error creating category:", error);
      alert("Failed to create category");
    }
  }

  async function handleDelete(categoryId: string) {
    if (!confirm("Are you sure you want to delete this feature category?")) return;
    
    try {
      const response = await fetch(`/api/admin/feature-categories/${categoryId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const data = await response.json();
        if (data.featureCount) {
          alert(`Cannot delete: Category contains ${data.featureCount} feature(s). ${data.suggestion}`);
        } else {
          alert("Failed to delete category");
        }
        return;
      }
      
      await fetchCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("Failed to delete category");
    }
  }

  async function handleReorder(categoryId: string, direction: 'up' | 'down') {
    const category = categories.find(c => c.categoryId === categoryId);
    if (!category) return;

    const sortedCategories = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);
    const currentIndex = sortedCategories.findIndex(c => c.categoryId === categoryId);
    
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === sortedCategories.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const swapCategory = sortedCategories[swapIndex];

    try {
      // Swap display orders
      await Promise.all([
        fetch(`/api/admin/feature-categories/${category.categoryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: swapCategory.displayOrder }),
        }),
        fetch(`/api/admin/feature-categories/${swapCategory.categoryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: category.displayOrder }),
        }),
      ]);

      await fetchCategories();
    } catch (error) {
      console.error("Error reordering categories:", error);
      alert("Failed to reorder categories");
    }
  }

  function getCategoryColor(categoryKey: string): string {
    const colors: Record<string, string> = {
      'CONTENT_MANAGEMENT': 'bg-blue-100 text-blue-800',
      'SOCIAL_FEATURES': 'bg-green-100 text-green-800',
      'AI_FEATURES': 'bg-purple-100 text-purple-800',
      'ORGANIZATION': 'bg-yellow-100 text-yellow-800',
      'ANALYTICS': 'bg-indigo-100 text-indigo-800',
      'LIMITS': 'bg-gray-100 text-gray-800',
    };
    return colors[categoryKey] || 'bg-orange-100 text-orange-800';
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Feature Categories</h1>
          <p className="mt-2 text-gray-600">
            Manage feature categories to organize your application features.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/features"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Eye className="h-5 w-5" />
            Manage Features
          </Link>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add Category
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
              <h3 className="text-lg font-semibold mb-4">New Feature Category</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Key *
                  </label>
                  <input
                    type="text"
                    value={newForm.categoryKey}
                    onChange={(e) => setNewForm({ ...newForm, categoryKey: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="e.g., AI_FEATURES, SOCIAL_FEATURES"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={newForm.categoryName}
                    onChange={(e) => setNewForm({ ...newForm, categoryName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="e.g., AI Features, Social Features"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={newForm.displayOrder}
                    onChange={(e) => setNewForm({ ...newForm, displayOrder: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={newForm.isActive ? "true" : "false"}
                    onChange={(e) => setNewForm({ ...newForm, isActive: e.target.value === "true" })}
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
                  value={newForm.description}
                  onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  rows={3}
                  placeholder="Describe what types of features belong in this category..."
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

          {categories.map((category) => (
            <div
              key={category.categoryId}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              {editingId === category.categoryId ? (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category Key
                      </label>
                      <input
                        type="text"
                        value={editForm.categoryKey}
                        onChange={(e) => setEditForm({ ...editForm, categoryKey: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category Name
                      </label>
                      <input
                        type="text"
                        value={editForm.categoryName}
                        onChange={(e) => setEditForm({ ...editForm, categoryName: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        value={editForm.displayOrder}
                        onChange={(e) => setEditForm({ ...editForm, displayOrder: parseInt(e.target.value) || 1 })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                        min="1"
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
                      onClick={() => handleSave(category.categoryId)}
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
                        <h3 className="text-xl font-semibold text-gray-900">{category.categoryName}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(category.categoryKey)}`}>
                          {category.categoryKey}
                        </span>
                        <span className="px-2 py-1 bg-blue-50 text-blue-800 text-xs rounded-full">
                          Order: {category.displayOrder}
                        </span>
                        <span className="px-2 py-1 bg-green-50 text-green-800 text-xs rounded-full">
                          {category._count.features} features
                        </span>
                        {!category.isActive && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-2">
                        Key: <code className="bg-gray-100 px-1 rounded">{category.categoryKey}</code>
                      </p>
                      {category.description && (
                        <p className="text-gray-700 mb-4">{category.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReorder(category.categoryId, 'up')}
                        className="p-2 text-gray-600 hover:text-gray-800"
                        title="Move up"
                      >
                        <ArrowUp className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleReorder(category.categoryId, 'down')}
                        className="p-2 text-gray-600 hover:text-gray-800"
                        title="Move down"
                      >
                        <ArrowDown className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(category.categoryId);
                          setEditForm(category);
                        }}
                        className="p-2 text-blue-600 hover:text-blue-800"
                        title="Edit category"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(category.categoryId)}
                        className="p-2 text-red-600 hover:text-red-800"
                        title="Delete category"
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