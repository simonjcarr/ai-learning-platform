"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { Loader2, BookOpen, Sparkles, CreditCard, MoreVertical, BookmarkPlus, Check, Plus, X, Bookmark, Flag } from "lucide-react";
import Link from "next/link";
import InteractiveExamples from "./interactive-examples";
import MarkdownViewer from "@/components/markdown-viewer";
import CommentsList from "@/components/comments/comments-list";
import LikeButton from "@/components/like-button";
import { FlagButton } from "@/components/flag-button";
import { ArticleSuggestionForm } from "@/components/article-suggestion-form";
import { ArticleSuggestionFormInline } from "@/components/article-suggestion-form-inline";
import { ArticleChangeHistory } from "@/components/article-change-history";
import { FloatingActionMenu } from "@/components/floating-action-menu";

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
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [focusedExampleId, setFocusedExampleId] = useState<string | null>(null);
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
                  ? (
                    <div className="flex flex-wrap gap-2">
                      {article.categories.map((c, index) => (
                        <span key={c.category.categoryId}>
                          <Link 
                            href={`/categories/${c.category.categoryId}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {c.category.categoryName}
                          </Link>
                          {index < article.categories.length - 1 && <span className="text-gray-600">,</span>}
                        </span>
                      ))}
                    </div>
                  )
                  : 'Uncategorized'
              }
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LikeButton articleId={article.articleId} iconOnly />
            {article.contentHtml && (
              <MoreOptionsDropdown
                articleId={article.articleId}
                articleTitle={article.articleTitle}
                isFlagged={article.isFlagged}
                onShowSuggestion={() => setShowSuggestionModal(true)}
              />
            )}
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
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white shadow-sm hover:opacity-80 transition-opacity"
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
            <InteractiveExamples 
              articleId={article.articleId} 
              onFocusedExampleChange={setFocusedExampleId}
            />
          )}
          
          {/* Change History Section */}
          <ArticleChangeHistory articleId={article.articleId} />
          
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
    
    {showSuggestionModal && (
      <SuggestionModal
        articleId={article.articleId}
        isOpen={showSuggestionModal}
        onClose={() => setShowSuggestionModal(false)}
      />
    )}
    
    {/* Floating Action Menu */}
    {isSignedIn && <FloatingActionMenu articleId={article.articleId} currentExampleId={focusedExampleId || undefined} />}
    </>
  );
}

interface MoreOptionsDropdownProps {
  articleId: string;
  articleTitle: string;
  isFlagged: boolean;
  onShowSuggestion: () => void;
}

function MoreOptionsDropdown({ articleId, articleTitle, isFlagged, onShowSuggestion }: MoreOptionsDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showListModal, setShowListModal] = useState(false);

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="inline-flex items-center justify-center p-2 text-sm font-medium rounded-md transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
          title="More options"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
              <div className="py-1">
                <button
                  onClick={() => {
                    console.log('Manage Lists clicked');
                    setShowDropdown(false);
                    setShowListModal(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <BookmarkPlus className="h-4 w-4 mr-2" />
                  Manage Lists
                </button>
                <button
                  onClick={() => {
                    console.log('Suggest Improvement clicked');
                    setShowDropdown(false);
                    onShowSuggestion();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Suggest Improvement
                </button>
                <div className="border-t border-gray-100">
                  <FlagButtonMenuItem
                    articleId={articleId}
                    isFlagged={isFlagged}
                    onClose={() => setShowDropdown(false)}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showListModal && (
        <ListManagementModal
          articleId={articleId}
          articleTitle={articleTitle}
          isOpen={showListModal}
          onClose={() => setShowListModal(false)}
        />
      )}
    </>
  );
}

interface FlagButtonMenuItemProps {
  articleId: string;
  isFlagged: boolean;
  onClose: () => void;
}

function FlagButtonMenuItem({ articleId, isFlagged, onClose }: FlagButtonMenuItemProps) {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [flagReason, setFlagReason] = useState("");

  async function handleFlag() {
    if (!isSignedIn) {
      alert("Please sign in to flag content");
      return;
    }

    if (isFlagged) {
      alert("This content has already been flagged");
      return;
    }

    onClose();
    setShowReasonModal(true);
  }

  async function submitFlag() {
    try {
      setLoading(true);
      const response = await fetch(`/api/articles/${articleId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagReason }),
      });

      if (!response.ok) throw new Error("Failed to flag content");
      
      setShowReasonModal(false);
      setFlagReason("");
    } catch (error) {
      console.error("Error flagging content:", error);
      alert("Failed to flag content");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleFlag}
        disabled={loading || isFlagged}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center disabled:opacity-50"
        title={isFlagged ? "Already flagged" : "Flag as inappropriate"}
      >
        <Flag className="h-4 w-4 mr-2" fill={isFlagged ? "currentColor" : "none"} />
        <span>{isFlagged ? "Flagged" : "Flag"}</span>
      </button>

      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Flag Content</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for flagging this content:
            </p>
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Explain why this content is inappropriate..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 mb-4"
              rows={4}
              required
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowReasonModal(false);
                  setFlagReason("");
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={submitFlag}
                disabled={loading || !flagReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Submit Flag"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface ArticleSuggestionMenuItemProps {
  articleId: string;
  onClose: () => void;
}

function ArticleSuggestionMenuItem({ articleId, onClose }: ArticleSuggestionMenuItemProps) {
  return (
    <ArticleSuggestionFormInline articleId={articleId} onClose={onClose} />
  );
}

interface ListManagementModalProps {
  articleId: string;
  articleTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

function ListManagementModal({ articleId, articleTitle, isOpen, onClose }: ListManagementModalProps) {
  const [lists, setLists] = useState<any[]>([]);
  const [articleLists, setArticleLists] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState("");
  const { isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isOpen && isSignedIn) {
      fetchLists();
    }
  }, [isOpen, isSignedIn]);

  const fetchLists = async () => {
    setIsLoading(true);
    try {
      const [listsResponse, articleListsResponse] = await Promise.all([
        fetch("/api/lists"),
        fetch(`/api/articles/${articleId}/lists`)
      ]);
      
      if (listsResponse.ok) {
        const data = await listsResponse.json();
        setLists(data);
      }
      
      if (articleListsResponse.ok) {
        const data = await articleListsResponse.json();
        setArticleLists(new Set(data.listIds || []));
      }
    } catch (error) {
      console.error("Error fetching lists:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleList = async (listId: string) => {
    try {
      const isInList = articleLists.has(listId);
      const url = isInList 
        ? `/api/lists/${listId}/items?articleId=${articleId}`
        : `/api/lists/${listId}/items`;
      
      const response = await fetch(url, {
        method: isInList ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: isInList ? undefined : JSON.stringify({ articleId }),
      });

      if (response.ok) {
        if (isInList) {
          setArticleLists(prev => {
            const newSet = new Set(prev);
            newSet.delete(listId);
            return newSet;
          });
        } else {
          setArticleLists(prev => new Set([...prev, listId]));
        }
      }
    } catch (error) {
      console.error("Error toggling list:", error);
    }
  };

  const handleCreateNewList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ listName: newListName }),
      });

      if (response.ok) {
        const newList = await response.json();
        await handleToggleList(newList.listId);
        setNewListName("");
        setShowNewListForm(false);
        fetchLists();
      }
    } catch (error) {
      console.error("Error creating list:", error);
    }
  };

  if (!isSignedIn) {
    return null;
  }

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
        >
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold">Manage Lists</h2>
              <p className="text-sm text-gray-600 mt-1">Add "{articleTitle}" to your lists</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    {lists.map((list) => (
                      <button
                        key={list.listId}
                        onClick={() => handleToggleList(list.listId)}
                        className="w-full text-left p-2 rounded-lg border hover:bg-gray-50 flex items-center justify-between group"
                      >
                        <div>
                          <p className="font-medium text-sm">{list.listName}</p>
                          {list.description && (
                            <p className="text-xs text-gray-600">{list.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {articleLists.has(list.listId) ? (
                            <>
                              <Check className="h-4 w-4 text-green-600" />
                              <X className="h-4 w-4 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </>
                          ) : (
                            <Plus className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {!showNewListForm ? (
                    <button
                      onClick={() => setShowNewListForm(true)}
                      className="w-full mt-3 p-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 flex items-center justify-center text-gray-600 hover:text-gray-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create new list
                    </button>
                  ) : (
                    <form onSubmit={handleCreateNewList} className="mt-3 p-2 border rounded-lg">
                      <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        placeholder="List name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          type="submit"
                          className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewListForm(false);
                            setNewListName("");
                          }}
                          className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
            
            <div className="p-4 border-t space-y-2">
              <Link
                href="/dashboard/lists"
                onClick={onClose}
                className="block w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-center text-sm"
              >
                Manage All Lists
              </Link>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface SuggestionModalProps {
  articleId: string;
  isOpen: boolean;
  onClose: () => void;
}

function SuggestionModal({ articleId, isOpen, onClose }: SuggestionModalProps) {
  const { user } = useUser();
  const { isSubscribed, isLoadingSubscription } = useSubscription();
  const [suggestionType, setSuggestionType] = useState('');
  const [suggestionDetails, setSuggestionDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasFreshResponse, setHasFreshResponse] = useState(false);

  const suggestionTypes = [
    { value: 'CONTENT_ADDITION', label: 'Add missing content' },
    { value: 'CONTENT_CORRECTION', label: 'Correct an error' },
    { value: 'GRAMMAR_SPELLING', label: 'Fix grammar/spelling' },
    { value: 'CODE_IMPROVEMENT', label: 'Improve code example' },
    { value: 'CLARITY_IMPROVEMENT', label: 'Improve clarity' },
    { value: 'EXAMPLE_ADDITION', label: 'Add an example' },
    { value: 'LINK_UPDATE', label: 'Update a link' },
    { value: 'OTHER', label: 'Other improvement' },
  ];

  const fullReset = () => {
    setSuggestionType('');
    setSuggestionDetails('');
    setResult(null);
    setHasFreshResponse(false);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    onClose();
    fullReset();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    if (!suggestionType || !suggestionDetails.trim()) {
      setResult({ success: false, message: 'Please select a suggestion type and provide details.' });
      setHasFreshResponse(true);
      setIsSubmitting(false);
      return;
    }
    setResult(null);

    try {
      const response = await fetch(`/api/articles/${articleId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionType, suggestionDetails }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.suggestion && typeof data.suggestion.isApproved === 'boolean') {
          setResult({
            success: data.suggestion.isApproved,
            message: data.suggestion.isApproved 
              ? `Great! Your suggestion has been approved and applied. You now have ${data.approvedSuggestionsCount} approved suggestions! Please refresh your browser to see the changes.`
              : data.message || data.suggestion.rejectionReason || 'Your suggestion was not approved at this time. It has been saved for review.',
          });
        } else {
          setResult({ success: false, message: data.message || 'Received an unexpected response from the server.' });
        }
      } else {
        setResult({ success: false, message: data.message || data.error || `Request failed with status ${response.status}.` });
      }
      setHasFreshResponse(true);

    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to submit suggestion',
      });
      setHasFreshResponse(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.3)', 
        zIndex: 9999
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Suggest an Improvement</h2>
            <p className="text-sm text-gray-600 mt-1">
              Your feedback helps us improve our content.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!isSubscribed && !isLoadingSubscription ? (
            <div className="text-center">
              <CreditCard className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Subscription Required
              </h3>
              <p className="text-gray-600 mb-4">
                Article suggestions are available to subscribed users. Upgrade your plan to suggest improvements.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <Link href="/pricing" className="flex-1">
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    View Plans
                  </button>
                </Link>
              </div>
            </div>
          ) : hasFreshResponse && result ? (
            <div>
              <div className={`p-3 rounded-md text-sm mb-4 ${result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {result.message}
              </div>
              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="suggestion-type" className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  id="suggestion-type"
                  value={suggestionType}
                  onChange={(e) => setSuggestionType(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select improvement type</option>
                  {suggestionTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="suggestion-details" className="block text-sm font-medium text-gray-700 mb-2">
                  Details
                </label>
                <textarea
                  id="suggestion-details"
                  placeholder="Please provide specific details about your suggestion..."
                  value={suggestionDetails}
                  onChange={(e) => setSuggestionDetails(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}