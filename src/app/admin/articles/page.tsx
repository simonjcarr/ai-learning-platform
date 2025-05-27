"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Edit, Trash2, Eye, Flag } from "lucide-react";
import { format } from "date-fns";

interface Article {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  categoryId: string | null;
  category: {
    categoryName: string;
  } | null;
  isContentGenerated: boolean;
  isFlagged: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    likes: number;
    comments: number;
  };
}

export default function AdminArticlesPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<"all" | "flagged" | "generated">("all");

  useEffect(() => {
    fetchArticles();
  }, [page, search, filter]);

  async function fetchArticles() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        search,
        filter,
      });
      
      const response = await fetch(`/api/admin/articles?${params}`);
      if (!response.ok) throw new Error("Failed to fetch articles");
      
      const data = await response.json();
      setArticles(data.articles);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error("Error fetching articles:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(articleId: string) {
    if (!confirm("Are you sure you want to delete this article?")) return;
    
    try {
      const response = await fetch(`/api/admin/articles/${articleId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error("Failed to delete article");
      
      await fetchArticles();
    } catch (error) {
      console.error("Error deleting article:", error);
      alert("Failed to delete article");
    }
  }

  async function handleToggleFlag(articleId: string, currentFlag: boolean) {
    try {
      const response = await fetch(`/api/admin/articles/${articleId}/flag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFlagged: !currentFlag }),
      });
      
      if (!response.ok) throw new Error("Failed to update flag");
      
      await fetchArticles();
    } catch (error) {
      console.error("Error updating flag:", error);
      alert("Failed to update flag");
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Article Management</h1>
        <p className="mt-2 text-gray-600">
          Search, edit, and manage all articles in the system
        </p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search articles..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>
        
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as typeof filter);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          <option value="all">All Articles</option>
          <option value="flagged">Flagged Only</option>
          <option value="generated">AI Generated</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No articles found</div>
      ) : (
        <>
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stats
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {articles.map((article) => (
                  <tr key={article.articleId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {article.articleTitle}
                        </div>
                        <div className="text-sm text-gray-500">
                          {article.articleSlug}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {article.category?.categoryName || "Uncategorized"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {article._count.likes} likes, {article._count.comments} comments
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        {article.isContentGenerated && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            AI Generated
                          </span>
                        )}
                        {article.isFlagged && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Flagged
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(article.updatedAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => router.push(`/articles/${article.articleSlug}`)}
                          className="text-gray-600 hover:text-gray-900"
                          title="View"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => router.push(`/admin/articles/${article.articleId}/edit`)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleToggleFlag(article.articleId, article.isFlagged)}
                          className={article.isFlagged ? "text-green-600 hover:text-green-900" : "text-orange-600 hover:text-orange-900"}
                          title={article.isFlagged ? "Unflag" : "Flag"}
                        >
                          <Flag className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(article.articleId)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}