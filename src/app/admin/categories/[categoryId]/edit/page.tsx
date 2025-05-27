'use client';

import { use, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Role } from '@prisma/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ categoryId: string }>;
}

interface Category {
  categoryId: string;
  categoryName: string;
  description: string | null;
  _count: {
    articles: number;
  };
}

export default function EditCategoryPage({ params }: PageProps) {
  const { categoryId } = use(params);
  const router = useRouter();
  const { hasMinRole, isLoadingRole } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    categoryName: '',
    description: '',
  });

  useEffect(() => {
    if (!isLoadingRole && hasMinRole(Role.ADMIN)) {
      fetchCategory();
    } else if (!isLoadingRole && !hasMinRole(Role.ADMIN)) {
      router.push('/dashboard');
    }
  }, [isLoadingRole, categoryId]);

  async function fetchCategory() {
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`);
      if (!response.ok) throw new Error('Failed to fetch category');
      const data = await response.json();
      setCategory(data);
      setFormData({
        categoryName: data.categoryName,
        description: data.description || '',
      });
    } catch (error) {
      console.error('Error fetching category:', error);
      setError('Failed to load category');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to update category');

      router.push('/admin/categories');
    } catch (error) {
      console.error('Error updating category:', error);
      setError('Failed to update category');
      setSaving(false);
    }
  }

  if (isLoadingRole || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">Category not found</p>
        <Link href="/admin/categories" className="text-orange-600 hover:text-orange-700">
          Back to categories
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/categories" className="text-orange-600 hover:text-orange-700">
          ← Back to categories
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Category</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name *
          </label>
          <input
            type="text"
            id="name"
            value={formData.categoryName}
            onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
          />
        </div>

        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            rows={4}
          />
        </div>

        {category._count.articles > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              This category contains {category._count.articles} article{category._count.articles === 1 ? '' : 's'}.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href="/admin/categories"
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}