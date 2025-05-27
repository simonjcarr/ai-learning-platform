"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2, BookOpen, Sparkles, CreditCard } from "lucide-react";
import Link from "next/link";
import InteractiveExamples from "./interactive-examples";
import MarkdownViewer from "@/components/markdown-viewer";
import CommentsList from "@/components/comments/comments-list";
import LikeButton from "@/components/like-button";
import AddToListButton from "@/components/add-to-list-button";
import { FlagButton } from "@/components/flag-button";

interface Article {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  contentHtml: string | null;
  isContentGenerated: boolean;
  isFlagged: boolean;
  categories: Array<{
    category: {
      categoryId: string;
      categoryName: string;
    };
  }>;
  stream: {
    streamId: string;
    streamName: string;
    channel: {
      channelId: string;
      channelName: string;
    };
  } | null;
  createdBy: {
    username: string | null;
  } | null;
  tags: Array<{
    tag: {
      tagId: string;
      tagName: string;
      description: string | null;
      color: string | null;
    };
  }>;
}

interface ArticleContentProps {
  article: Article;
}

export default function ArticleContent({ article: initialArticle }: ArticleContentProps) {
  const [article, setArticle] = useState(initialArticle);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionError, setSubscriptionError] = useState(false);
  const { isSignedIn } = useUser();

  useEffect(() => {
    if (!article.isContentGenerated && !article.contentHtml && isSignedIn) {
      generateContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.isContentGenerated, article.contentHtml, isSignedIn]);

  useEffect(() => {
    // Track article view when component mounts and user is signed in
    if (isSignedIn && article.articleId) {
      trackArticleView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, article.articleId]);

  const trackArticleView = async () => {
    try {
      const response = await fetch(`/api/articles/${article.articleId}/view`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.error("Failed to track article view:", response.status, data);
      } else {
        console.log("Article view tracked successfully");
      }
    } catch (err) {
      console.error("Failed to track article view:", err);
    }
  };

  const generateContent = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/articles/${article.articleId}/generate`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 403 && data.error === "Subscription required") {
          setSubscriptionError(true);
          throw new Error(data.message || "Subscription required");
        }
        throw new Error(data.error || "Failed to generate content");
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
    <>
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
          {article.stream ? (
            <>
              <li>
                <Link href="/channels" className="hover:text-gray-900">
                  Channels
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link 
                  href={`/channels#${article.stream.channel.channelId}`} 
                  className="hover:text-gray-900"
                >
                  {article.stream.channel.channelName}
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link 
                  href={`/search/v2?channel=${article.stream.channel.channelId}&stream=${article.stream.streamId}`} 
                  className="hover:text-gray-900"
                >
                  {article.stream.streamName}
                </Link>
              </li>
            </>
          ) : article.categories && article.categories.length > 0 ? (
            <>
              <li>
                <Link href="/categories" className="hover:text-gray-900">
                  Categories
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link 
                  href={`/categories/${article.categories[0].category.categoryId}`} 
                  className="hover:text-gray-900"
                >
                  {article.categories[0].category.categoryName}
                </Link>
              </li>
            </>
          ) : null}
          <li>/</li>
          <li className="text-gray-900 font-medium">{article.articleTitle}</li>
        </ol>
      </nav>

      {/* Article Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {article.articleTitle}
        </h1>
        <div className="flex items-center justify-between">
          <div className="flex items-center text-gray-600">
            <BookOpen className="h-5 w-5 mr-2" />
            <span>
              {article.stream 
                ? `${article.stream.channel.channelName} / ${article.stream.streamName}`
                : article.categories && article.categories.length > 0 
                  ? article.categories.map(c => c.category.categoryName).join(', ')
                  : 'Uncategorized'
              }
            </span>
            {article.createdBy?.username && (
              <>
                <span className="mx-2">•</span>
                <span>by {article.createdBy.username}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <LikeButton articleId={article.articleId} />
            <AddToListButton 
              articleId={article.articleId} 
              articleTitle={article.articleTitle}
            />
            <FlagButton 
              type="article" 
              id={article.articleId} 
              isFlagged={article.isFlagged}
            />
          </div>
        </div>
        
        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              {article.tags.map(({ tag }) => (
                <Link
                  key={tag.tagId}
                  href={`/search?q=${encodeURIComponent(`#${tag.tagName}`)}`}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white shadow-sm hover:opacity-80 transition-opacity"
                  style={{ 
                    backgroundColor: tag.color || '#3B82F6',
                  }}
                  title={tag.description ? `${tag.description} - Click to find more articles with this tag` : `Click to find more articles with #${tag.tagName}`}
                >
                  #{tag.tagName}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      {error && !subscriptionError && (
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
          <div className="mb-12">
            <MarkdownViewer content={article.contentHtml} removeFirstHeading={true} />
          </div>
          
          {/* Interactive Examples Section */}
          {isSignedIn && (
            <InteractiveExamples articleId={article.articleId} />
          )}
          
          {/* Comments Section */}
          <CommentsList articleId={article.articleId} />
        </>
      ) : (
        <div className="text-center py-20">
          {subscriptionError ? (
            <>
              <CreditCard className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Subscription Required
              </h3>
              <p className="text-gray-600 mb-4 max-w-md mx-auto">
                To access AI-generated content and unlock all platform features, please subscribe to one of our plans.
              </p>
              <div className="space-y-3">
                <Link
                  href="/pricing"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  View Subscription Plans
                </Link>
                <p className="text-sm text-gray-500">
                  Starting at just $9.99/month
                </p>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
    
    </>
  );
}