"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Loader2, Folder, FileText, Sparkles } from "lucide-react";

interface SearchResults {
  query: string;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    description: string | null;
  }>;
  articles: Array<{
    articleId: string;
    articleTitle: string;
    articleSlug: string;
    isContentGenerated: boolean;
    categories: Array<{
      category: {
        categoryName: string;
      };
    }>;
    tags: Array<{
      tag: {
        tagId: string;
        tagName: string;
        description: string | null;
        color: string | null;
      };
    }>;
  }>;
  aiSuggestions: {
    newCategoriesAdded: number;
    newArticlesAdded: number;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRestoringFromURL, setIsRestoringFromURL] = useState(false);

  // Initialize state from URL parameters on component mount
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    const urlPage = searchParams.get('page');
    
    if (urlQuery) {
      setQuery(urlQuery);
      const pageNum = urlPage ? parseInt(urlPage, 10) : 1;
      setCurrentPage(pageNum);
      
      // Show loading state immediately when restoring from URL
      setIsRestoringFromURL(true);
      setLoading(true);
      setError(null);
      
      // Perform search if we have a query from URL
      performSearch(urlQuery, pageNum);
    }
  }, [searchParams]);

  const performSearch = async (searchQuery: string, page: number = 1) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: searchQuery, page, limit: 20 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Search failed");
      }

      const data = await response.json();
      console.log("Search results:", data);
      setResults(data);
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setIsRestoringFromURL(false);
    }
  };

  const updateURL = (searchQuery: string, page: number = 1) => {
    const params = new URLSearchParams();
    params.set('q', searchQuery);
    if (page > 1) {
      params.set('page', page.toString());
    }
    router.replace(`/search?${params.toString()}`, { scroll: false });
  };

  const handleSearch = async (e: React.FormEvent, page: number = 1) => {
    e.preventDefault();
    if (!query.trim()) return;

    setCurrentPage(page);
    updateURL(query, page);
    await performSearch(query, page);
  };

  const handlePageChange = (page: number) => {
    if (results && query) {
      setCurrentPage(page);
      updateURL(query, page);
      performSearch(query, page);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          What would you like to learn today?
        </h1>
        <p className="text-lg text-gray-600">
          Search for any IT topic and we&apos;ll find or create the perfect learning resources for you
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-12">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for Linux commands, cloud services, programming concepts..."
            className="w-full px-4 py-3 pl-12 pr-32 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-2 px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Search"
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {/* Loading state when restoring from URL */}
      {isRestoringFromURL && (
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <Loader2 className="h-5 w-5 text-blue-600 mr-2 animate-spin" />
            <p className="text-blue-800">Restoring your search results...</p>
          </div>
        </div>
      )}

      {/* Regular loading state for new searches */}
      {loading && !isRestoringFromURL && !results && (
        <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <Loader2 className="h-5 w-5 text-gray-600 mr-2 animate-spin" />
            <p className="text-gray-700">Searching...</p>
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-8">
          {results.aiSuggestions.newCategoriesAdded > 0 || results.aiSuggestions.newArticlesAdded > 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <Sparkles className="h-5 w-5 text-blue-600 mr-2" />
                <p className="text-blue-800">
                  AI enhanced your search: Added {results.aiSuggestions.newCategoriesAdded} new categories 
                  and {results.aiSuggestions.newArticlesAdded} new article topics!
                </p>
              </div>
            </div>
          ) : null}

          {results.categories.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Folder className="h-5 w-5 mr-2" />
                Categories
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.categories.map((category) => (
                  <Link
                    key={category.categoryId}
                    href={`/categories/${category.categoryId}`}
                    className="block p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-medium text-gray-900">{category.categoryName}</h3>
                    {category.description && (
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                        {category.description}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.articles.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Articles
              </h2>
              <div className="space-y-4">
                {results.articles.map((article) => (
                  <div
                    key={article.articleId}
                    className="p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Link
                          href={`/articles/${article.articleSlug}`}
                          className="hover:text-blue-600 transition-colors"
                        >
                          <h3 className="font-medium text-gray-900 hover:text-blue-600">
                            {article.articleTitle}
                          </h3>
                        </Link>
                        <p className="mt-1 text-sm text-gray-600">
                          in {article.categories?.map(c => c.category.categoryName).join(', ') || 'No category'}
                        </p>
                        {/* Tags */}
                        {article.tags && article.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {article.tags.map(({ tag }) => (
                              <Link
                                key={tag.tagId}
                                href={`/search?q=${encodeURIComponent(`#${tag.tagName}`)}`}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white hover:opacity-80 transition-opacity"
                                style={{ 
                                  backgroundColor: tag.color || '#3B82F6',
                                }}
                                title={tag.description ? `${tag.description} - Click to find more articles with this tag` : `Click to find more articles with #${tag.tagName}`}
                              >
                                #{tag.tagName}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                      {!article.isContentGenerated && (
                        <span className="ml-4 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          Content pending
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {results.categories.length === 0 && results.articles.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">
                No results found for &ldquo;{results.query}&rdquo;. Try searching for a different topic!
              </p>
            </div>
          )}

          {/* Pagination */}
          {results.pagination && results.pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((results.pagination.page - 1) * results.pagination.limit) + 1}-
                {Math.min(results.pagination.page * results.pagination.limit, results.pagination.total)} of {results.pagination.total} results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(results.pagination!.page - 1)}
                  disabled={!results.pagination.hasPreviousPage || loading}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                >
                  Previous
                </button>
                
                {/* Page numbers */}
                <div className="flex space-x-1">
                  {Array.from({ length: Math.min(5, results.pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (results.pagination!.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (results.pagination!.page <= 3) {
                      pageNum = i + 1;
                    } else if (results.pagination!.page >= results.pagination!.totalPages - 2) {
                      pageNum = results.pagination!.totalPages - 4 + i;
                    } else {
                      pageNum = results.pagination!.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={loading}
                        className={`px-3 py-1 text-sm font-medium border rounded-md transition-colors ${
                          pageNum === results.pagination!.page
                            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:cursor-pointer'
                            : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 hover:cursor-pointer'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(results.pagination!.page + 1)}
                  disabled={!results.pagination.hasNextPage || loading}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}