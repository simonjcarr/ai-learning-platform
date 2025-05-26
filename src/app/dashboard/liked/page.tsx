"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Heart, Loader2, BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LikedArticle {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  likedAt: string;
  category: {
    categoryId: string;
    categoryName: string;
  } | null;
  _count: {
    comments: number;
    likes: number;
  };
}

export default function LikedArticlesPage() {
  const [articles, setArticles] = useState<LikedArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLikedArticles();
  }, []);

  const fetchLikedArticles = async () => {
    try {
      const response = await fetch("/api/articles/liked");
      if (response.ok) {
        const data = await response.json();
        setArticles(data);
      }
    } catch (error) {
      console.error("Error fetching liked articles:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Heart className="h-8 w-8 text-red-600 fill-current" />
          Liked Articles
        </h1>
        <p className="mt-2 text-gray-600">
          Articles you've liked for quick access
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No liked articles yet
          </h3>
          <p className="mt-2 text-gray-600">
            Start exploring and like articles to see them here
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Browse Articles
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.articleId}
              href={`/articles/${article.articleSlug}`}
              className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                {article.articleTitle}
              </h3>
              
              <div className="flex items-center text-sm text-gray-500 mb-3">
                <BookOpen className="h-4 w-4 mr-1" />
                <span>{article.category?.categoryName || "Uncategorized"}</span>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Heart className="h-4 w-4" />
                    {article._count.likes}
                  </span>
                  <span>{article._count.comments} comments</span>
                </div>
                <span className="text-xs">
                  {formatDistanceToNow(new Date(article.likedAt), { addSuffix: true })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}