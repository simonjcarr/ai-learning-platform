"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Folder, FileText, Loader2 } from "lucide-react";

interface Category {
  categoryId: string;
  categoryName: string;
  description: string | null;
  _count: {
    articles: number;
  };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Browse Categories</h1>
        <p className="mt-2 text-gray-600">
          Explore our growing collection of IT learning resources
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12">
          <Folder className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No categories yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Start searching to generate categories and content!
          </p>
          <div className="mt-6">
            <Link
              href="/search"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Go to Search
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Link
              key={category.categoryId}
              href={`/categories/${category.categoryId}`}
              className="block p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {category.categoryName}
                  </h3>
                  {category.description && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                      {category.description}
                    </p>
                  )}
                </div>
                <Folder className="ml-4 h-5 w-5 text-blue-600 flex-shrink-0" />
              </div>
              <div className="mt-4 flex items-center text-sm text-gray-500">
                <FileText className="h-4 w-4 mr-1" />
                <span>{category._count.articles} articles</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}