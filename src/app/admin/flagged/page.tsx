"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Flag, Check, X, MessageSquare, FileText } from "lucide-react";

interface FlaggedItem {
  id: string;
  type: "article" | "comment";
  content: string;
  title?: string;
  flaggedAt: string;
  flagReason: string | null;
  flaggedBy: {
    username: string | null;
    email: string;
  };
  author: {
    username: string | null;
    email: string;
  };
  articleInfo?: {
    articleId: string;
    articleTitle: string;
    articleSlug: string;
  };
}

export default function AdminFlaggedPage() {
  const [flaggedItems, setFlaggedItems] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "articles" | "comments">("all");

  useEffect(() => {
    fetchFlaggedContent();
  }, [filter]);

  async function fetchFlaggedContent() {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/flagged?type=${filter}`);
      if (!response.ok) throw new Error("Failed to fetch flagged content");
      
      const data = await response.json();
      setFlaggedItems(data.items);
    } catch (error) {
      console.error("Error fetching flagged content:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(id: string, type: "article" | "comment", action: "approve" | "remove") {
    try {
      const response = await fetch(`/api/admin/flagged/${type}/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      
      if (!response.ok) throw new Error("Failed to resolve flagged item");
      
      await fetchFlaggedContent();
    } catch (error) {
      console.error("Error resolving flagged item:", error);
      alert("Failed to resolve flagged item");
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Flagged Content</h1>
        <p className="mt-2 text-gray-600">
          Review and moderate flagged articles and comments
        </p>
      </div>

      <div className="mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "all"
                ? "bg-orange-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            All Content
          </button>
          <button
            onClick={() => setFilter("articles")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "articles"
                ? "bg-orange-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Articles Only
          </button>
          <button
            onClick={() => setFilter("comments")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "comments"
                ? "bg-orange-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Comments Only
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : flaggedItems.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Flag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No flagged content to review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {flaggedItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {item.type === "article" ? (
                      <FileText className="h-5 w-5 text-blue-600" />
                    ) : (
                      <MessageSquare className="h-5 w-5 text-green-600" />
                    )}
                    <span className="text-sm font-medium text-gray-500 uppercase">
                      {item.type}
                    </span>
                    <span className="text-sm text-gray-500">
                      Flagged {format(new Date(item.flaggedAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  
                  {item.type === "article" && item.title && (
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {item.title}
                    </h3>
                  )}
                  
                  {item.type === "comment" && item.articleInfo && (
                    <div className="mb-2">
                      <span className="text-sm text-gray-500">On article: </span>
                      <a
                        href={`/articles/${item.articleInfo.articleSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        {item.articleInfo.articleTitle}
                      </a>
                    </div>
                  )}
                  
                  <div className="prose prose-sm max-w-none mb-4">
                    <p className="text-gray-700 line-clamp-3">{item.content}</p>
                  </div>
                  
                  {item.flagReason && (
                    <div className="mb-4 p-3 bg-red-50 rounded-md">
                      <p className="text-sm text-red-800">
                        <span className="font-medium">Flag reason:</span> {item.flagReason}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                    <div>
                      <span className="font-medium">Author:</span>{" "}
                      {item.author.username || item.author.email}
                    </div>
                    <div>
                      <span className="font-medium">Flagged by:</span>{" "}
                      {item.flaggedBy.username || item.flaggedBy.email}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleResolve(item.id, item.type, "approve")}
                    className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    title="Approve (Remove flag)"
                  >
                    <Check className="h-4 w-4" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleResolve(item.id, item.type, "remove")}
                    className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    title="Remove content"
                  >
                    <X className="h-4 w-4" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}