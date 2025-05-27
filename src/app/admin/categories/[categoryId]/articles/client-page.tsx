'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, FileText, Calendar, Eye, Heart, MessageSquare, MoveHorizontal, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Role } from '@prisma/client';
import { useRouter } from 'next/navigation';

interface Article {
  id: string;
  title: string;
  slug: string;
  createdAt: string;
  viewCount: number;
  _count: {
    likes: number;
    comments: number;
  };
}

interface Category {
  id: string;
  categoryName: string;
  description: string | null;
  _count: {
    articles: number;
  };
}

interface SearchArticle extends Article {
  categories: Array<{
    category: {
      id: string;
      categoryName: string;
    };
  }>;
}

export default function CategoryArticlesClientPage({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const { hasMinRole, userRole } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticles, setSelectedArticles] = useState<{ [key: string]: string }>({});
  const [moving, setMoving] = useState<string | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchArticle[]>([]);
  const [searching, setSearching] = useState(false);

  // Start fetching data immediately
  useEffect(() => {
    fetchCategoryAndArticles();
    fetchCategories();
  }, [categoryId]);

  // Handle authorization separately
  useEffect(() => {
    if (userRole && !hasMinRole(Role.ADMIN)) {
      router.push('/dashboard');
    }
  }, [userRole, hasMinRole, router]);

  async function fetchCategoryAndArticles() {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch both in parallel
      const [categoryResponse, articlesResponse] = await Promise.all([
        fetch(`/api/admin/categories/${categoryId}`),
        fetch(`/api/admin/categories/${categoryId}/articles`)
      ]);

      if (!categoryResponse.ok) throw new Error('Failed to fetch category');
      if (!articlesResponse.ok) throw new Error('Failed to fetch articles');

      const [categoryData, articlesData] = await Promise.all([
        categoryResponse.json(),
        articlesResponse.json()
      ]);

      setCategory(categoryData);
      setArticles(articlesData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const response = await fetch('/api/admin/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }

  async function moveArticle(articleId: string, newCategoryId: string) {
    if (!newCategoryId || newCategoryId === categoryId) return;

    setMoving(articleId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/articles/${articleId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: newCategoryId }),
      });

      if (!response.ok) throw new Error('Failed to move article');

      // Refresh the articles list
      await fetchCategoryAndArticles();
      setSelectedArticles({ ...selectedArticles, [articleId]: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move article');
    } finally {
      setMoving(null);
    }
  }

  async function searchArticles() {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(`/api/admin/articles/search?q=${encodeURIComponent(searchQuery)}&excludeCategory=${categoryId}`);
      if (!response.ok) throw new Error('Failed to search articles');
      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  }

  async function moveArticleFromSearch(articleId: string) {
    setMoving(articleId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/articles/${articleId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      });

      if (!response.ok) throw new Error('Failed to move article');

      // Remove from search results and refresh articles
      setSearchResults(searchResults.filter(a => a.id !== articleId));
      await fetchCategoryAndArticles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move article');
    } finally {
      setMoving(null);
    }
  }

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (showSearchModal && searchQuery) {
        searchArticles();
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, showSearchModal]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading category and articles...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold mb-2">Error loading data</h2>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => {
              setError(null);
              fetchCategoryAndArticles();
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  if (!category) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Category not found</p>
        <Link href="/admin/categories" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
          ← Back to Categories
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/admin/categories" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Categories
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Articles in {category.categoryName}</h1>
            {category.description && (
              <p className="text-gray-600 mb-4">{category.description}</p>
            )}
            <p className="text-sm text-gray-500">
              Total articles: {articles.length}
            </p>
          </div>
          
          <button
            onClick={() => setShowSearchModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            Search Other Articles
          </button>
        </div>
      </div>

      {articles.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">No articles in this category yet.</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Article
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stats
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Move to Category
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link 
                      href={`/admin/articles/${article.id}/edit`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {article.title}
                    </Link>
                    <p className="text-sm text-gray-500 mt-1">{article.slug}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {article.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        {article._count.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        {article._count.comments}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(article.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedArticles[article.id] || ''}
                        onChange={(e) => setSelectedArticles({ ...selectedArticles, [article.id]: e.target.value })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        disabled={moving === article.id}
                      >
                        <option value="">Select category...</option>
                        {categories
                          .filter(cat => cat.id !== categoryId)
                          .map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.categoryName} ({cat._count.articles})
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => moveArticle(article.id, selectedArticles[article.id])}
                        disabled={!selectedArticles[article.id] || moving === article.id}
                        className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {moving === article.id ? (
                          'Moving...'
                        ) : (
                          <>
                            <MoveHorizontal className="h-4 w-4" />
                            Move
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Search Articles from Other Categories</h2>
                <button
                  onClick={() => {
                    setShowSearchModal(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles by title..."
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {searching ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-500">Searching...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {searchQuery ? 'No articles found.' : 'Enter a search term to find articles.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResults.map((article) => (
                    <div key={article.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{article.title}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            Current categories: <span className="font-medium">{article.categories?.map(c => c.category.categoryName).join(', ') || 'None'}</span>
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              {article.viewCount} views
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-4 w-4" />
                              {article._count.likes} likes
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-4 w-4" />
                              {article._count.comments} comments
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => moveArticleFromSearch(article.id)}
                          disabled={moving === article.id}
                          className="ml-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {moving === article.id ? (
                            'Moving...'
                          ) : (
                            <>
                              <MoveHorizontal className="h-4 w-4" />
                              Move to {category.categoryName}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}