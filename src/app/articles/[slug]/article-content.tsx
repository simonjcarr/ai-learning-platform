"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2, BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import InteractiveExamples from "./interactive-examples";

interface Article {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  contentHtml: string | null;
  isContentGenerated: boolean;
  category: {
    categoryId: string;
    categoryName: string;
  };
  createdBy: {
    username: string | null;
  } | null;
}

interface ArticleContentProps {
  article: Article;
}

export default function ArticleContent({ article: initialArticle }: ArticleContentProps) {
  const [article, setArticle] = useState(initialArticle);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSignedIn } = useUser();

  useEffect(() => {
    if (!article.isContentGenerated && !article.contentHtml && isSignedIn) {
      generateContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.isContentGenerated, article.contentHtml, isSignedIn]);

  const generateContent = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/articles/${article.articleId}/generate`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate content");
      }

      const data = await response.json();
      setArticle(data.article);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center space-x-2 text-sm text-gray-600">
          <li>
            <Link href="/" className="hover:text-gray-900">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href="/categories" className="hover:text-gray-900">
              Categories
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link 
              href={`/categories/${article.category.categoryId}`} 
              className="hover:text-gray-900"
            >
              {article.category.categoryName}
            </Link>
          </li>
          <li>/</li>
          <li className="text-gray-900 font-medium">{article.articleTitle}</li>
        </ol>
      </nav>

      {/* Article Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {article.articleTitle}
        </h1>
        <div className="flex items-center text-gray-600">
          <BookOpen className="h-5 w-5 mr-2" />
          <span>{article.category.categoryName}</span>
          {article.createdBy?.username && (
            <>
              <span className="mx-2">•</span>
              <span>by {article.createdBy.username}</span>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      {error && (
        <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {generating ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">Generating article content...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
        </div>
      ) : article.contentHtml ? (
        <>
          <article 
            className="prose prose-lg prose-gray max-w-none mb-12 prose-headings:text-gray-900 prose-p:text-gray-800 prose-strong:text-gray-900 prose-code:text-gray-800 prose-pre:bg-gray-100 prose-pre:text-gray-800"
            dangerouslySetInnerHTML={{ __html: article.contentHtml }}
          />
          
          {/* Interactive Examples Section */}
          {isSignedIn && (
            <InteractiveExamples articleId={article.articleId} />
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <Sparkles className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Content Not Yet Generated
          </h3>
          {isSignedIn ? (
            <>
              <p className="text-gray-600 mb-4">
                This article&apos;s content will be generated automatically.
              </p>
              <button
                onClick={generateContent}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Generate Content Now
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-600 mb-4">
                Sign in to read this article and access interactive examples.
              </p>
              <Link
                href="/sign-in"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Sign In to Continue
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}