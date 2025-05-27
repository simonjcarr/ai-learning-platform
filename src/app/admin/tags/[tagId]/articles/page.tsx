'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Role } from '@prisma/client';
import { ArrowLeft, Search, Plus, X } from 'lucide-react';
import Link from 'next/link';

interface Tag {
  tagId: string;
  tagName: string;
  description: string | null;
  color: string | null;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  createdAt: string;
  isContentGenerated: boolean;
  category: {
    categoryName: string;
  } | null;
  _count: {
    likes: number;
    comments: number;
  };
}

interface TagArticlesData {
  tag: Tag;
  articles: Article[];
}

export default function TagArticlesPage({
  params,
}: {
  params: Promise<{ tagId: string }>;
}) {
  const { tagId } = use(params);
  const router = useRouter();
  const { hasMinRole, isLoadingRole } = useAuth();
  const [data, setData] = useState<TagArticlesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Article[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    fetchTagArticles();
  }, [tagId]);

  useEffect(() => {
    if (!isLoadingRole && !hasMinRole(Role.ADMIN)) {
      router.push('/dashboard');
    }
  }, [isLoadingRole, hasMinRole, router]);

  const fetchTagArticles = async () => {
    try {
      const response = await fetch(`/api/admin/tags/${tagId}/articles`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tag articles');
      }
      
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching tag articles:', error);
      setError('Failed to fetch tag articles');
    } finally {
      setLoading(false);
    }
  };

  const searchArticles = async (term: string) => {
    setSearchLoading(true);
    try {
      const searchParam = term ? `?search=${encodeURIComponent(term)}` : '';
      const response = await fetch(`/api/admin/tags/${tagId}/search-articles${searchParam}`);
      
      if (!response.ok) {
        throw new Error('Failed to search articles');
      }
      
      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching articles:', error);
      setError('Failed to search articles');
    } finally {
      setSearchLoading(false);
    }
  };

  const addTagToArticle = async (articleId: string) => {
    try {
      const response = await fetch(`/api/admin/tags/${tagId}/add-to-article`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ articleId }),
      });

      if (!response.ok) {
        throw new Error('Failed to add tag to article');
      }

      // Refresh the tag articles and search results
      await fetchTagArticles();
      if (searchTerm) {
        await searchArticles(searchTerm);
      } else {
        await searchArticles('');
      }
    } catch (error) {
      console.error('Error adding tag to article:', error);
      setError('Failed to add tag to article');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchArticles(searchTerm);
  };

  const openSearchModal = () => {
    setShowSearchModal(true);
    setSearchTerm('');
    setSearchResults([]);
    searchArticles(''); // Load all available articles
  };

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!hasMinRole(Role.ADMIN)) {
    return null;
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-lg">Loading tag articles...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Tag not found</p>
        <Link href="/admin/tags" className="mt-4 text-blue-600 hover:text-blue-800">
          Back to tags
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link
            href="/admin/tags"
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Tags
          </Link>
          <div className="flex items-center space-x-2">
            {data.tag.color && (
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: data.tag.color }}
              />
            )}
            <h1 className="text-3xl font-bold">#{data.tag.tagName}</h1>
          </div>
        </div>
        <button
          onClick={openSearchModal}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Articles</span>
        </button>
      </div>

      {data.tag.description && (
        <p className="text-gray-600 mb-6">{data.tag.description}</p>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Articles List */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium">
            Articles with this tag ({data.articles.length})
          </h2>
        </div>
        
        {data.articles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No articles found with this tag.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {data.articles.map((article) => (
              <div key={article.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                      <Link
                        href={`/articles/${article.slug}`}
                        className="hover:text-blue-600"
                        target="_blank"
                      >
                        {article.title}
                      </Link>
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>{article.category?.categoryName || 'Uncategorized'}</span>
                      <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                      <span>{article._count.likes} likes</span>
                      <span>{article._count.comments} comments</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        article.isContentGenerated 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {article.isContentGenerated ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/admin/articles/${article.id}/edit`}
                      className="text-indigo-600 hover:text-indigo-900 text-sm"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                Add Articles to #{data.tag.tagName}
              </h2>
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className="mb-4">
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search articles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
                >
                  {searchLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>

            <div className="overflow-y-auto max-h-96 border border-gray-200 rounded-md">
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchLoading ? 'Searching...' : 'No articles found without this tag.'}
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {searchResults.map((article) => (
                    <div key={article.id} className="px-4 py-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{article.title}</h4>
                          <div className="flex items-center space-x-3 text-sm text-gray-500 mt-1">
                            <span>{article.category?.categoryName || 'Uncategorized'}</span>
                            <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => addTagToArticle(article.id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Add Tag
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