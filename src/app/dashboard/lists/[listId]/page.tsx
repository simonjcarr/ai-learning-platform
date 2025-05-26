"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Loader2, Trash2, StickyNote, Globe, Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CuratedList {
  listId: string;
  listName: string;
  description: string | null;
  isPublic: boolean;
  items: {
    itemId: string;
    order: number;
    notes: string | null;
    addedAt: string;
    article: {
      articleId: string;
      articleTitle: string;
      articleSlug: string;
      category: {
        categoryId: string;
        categoryName: string;
      } | null;
    };
  }[];
  user: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
}

interface PageProps {
  params: Promise<{ listId: string }>;
}

export default function ListDetailPage({ params }: PageProps) {
  const { listId } = use(params);
  const [list, setList] = useState<CuratedList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchList();
  }, [listId]);

  const fetchList = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}`);
      if (response.ok) {
        const data = await response.json();
        setList(data);
      } else if (response.status === 404) {
        router.push("/dashboard/lists");
      }
    } catch (error) {
      console.error("Error fetching list:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveItem = async (articleId: string) => {
    if (!confirm("Remove this article from the list?")) return;

    try {
      const response = await fetch(`/api/lists/${listId}/items?articleId=${articleId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchList();
      }
    } catch (error) {
      console.error("Error removing item:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!list) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link
          href="/dashboard/lists"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to lists
        </Link>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{list.listName}</h1>
            {list.description && (
              <p className="mt-2 text-gray-600">{list.description}</p>
            )}
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                {list.isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {list.isPublic ? "Public" : "Private"}
              </span>
              <span>{list.items.length} articles</span>
              {list.user.username && (
                <span>by {list.user.username}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {list.items.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No articles in this list yet
          </h3>
          <p className="mt-2 text-gray-600">
            Add articles to this list from any article page
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Browse Articles
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {list.items
            .sort((a, b) => a.order - b.order)
            .map((item) => (
              <div
                key={item.itemId}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Link
                      href={`/articles/${item.article.articleSlug}`}
                      className="text-lg font-semibold text-gray-900 hover:text-blue-600"
                    >
                      {item.article.articleTitle}
                    </Link>
                    
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <BookOpen className="h-4 w-4 mr-1" />
                      <span>{item.article.category?.categoryName || "Uncategorized"}</span>
                      <span className="mx-2">•</span>
                      <span>Added {formatDistanceToNow(new Date(item.addedAt), { addSuffix: true })}</span>
                    </div>

                    {item.notes && (
                      <div className="mt-3 flex items-start gap-2">
                        <StickyNote className="h-4 w-4 text-gray-400 mt-0.5" />
                        <p className="text-sm text-gray-600">{item.notes}</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleRemoveItem(item.article.articleId)}
                    className="ml-4 text-red-600 hover:text-red-800"
                    title="Remove from list"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}