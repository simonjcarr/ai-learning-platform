"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
// import { useRouter } from "next/navigation";
import { useSubscription } from "@/hooks/use-subscription";
import { useRedirectUrl } from "@/hooks/use-redirect-url";
import { useFeatureAccess, useFeatureUsage } from "@/hooks/use-feature-access";
import { Loader2, BookOpen, Sparkles, CreditCard, MoreVertical, BookmarkPlus, Check, Plus, X, Flag, CheckCircle, ArrowLeft, ArrowRight, GraduationCap } from "lucide-react";
import Link from "next/link";
import InteractiveExamples from "./interactive-examples";
import MarkdownViewer from "@/components/markdown-viewer";
import CommentsList from "@/components/comments/comments-list";
import LikeButton from "@/components/like-button";
// import { ArticleSuggestionFormInline } from "@/components/article-suggestion-form-inline";
import { FloatingActionMenu } from "@/components/floating-action-menu";
import { SuggestionsList } from "@/components/suggestions/suggestions-list";

interface Article {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  contentHtml: string | null;
  isContentGenerated: boolean;
  isFlagged: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string[];
  seoImageUrl?: string | null;
  seoImageAlt?: string | null;
  seoLastModified?: string | Date | null;
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
  courseArticles?: Array<{
    section: {
      course: {
        courseId: string;
        title: string;
        slug: string;
        level: string;
      };
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
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingProgress, setStreamingProgress] = useState(0);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isContentComplete, setIsContentComplete] = useState(false);
  const [focusedExampleId, setFocusedExampleId] = useState<string | null>(null);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [courseInfo, setCourseInfo] = useState<{
    courseId: string;
    title: string;
    slug: string;
    level: string;
  } | null>(null);
  const { isSignedIn, user } = useUser();
  const { isSubscribed, isLoadingSubscription } = useSubscription();
  const { signInWithRedirect } = useRedirectUrl();
  
  // Feature access hooks
  const { access: contentAccess, loading: contentAccessLoading } = useFeatureAccess('generate_article_content');
  const { usage: generationUsage, loading: usageLoading } = useFeatureUsage('daily_article_generation_limit', 'daily');
  const { access: suggestionsAccess } = useFeatureAccess('suggest_article_improvements');


  useEffect(() => {
    // Auto-generate content if user has access and usage available
    if (!article.isContentGenerated && 
        !article.contentHtml && 
        isSignedIn && 
        contentAccess?.hasAccess && 
        generationUsage?.hasAccess && 
        !contentAccessLoading && 
        !usageLoading) {
      generateContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.isContentGenerated, article.contentHtml, isSignedIn, contentAccess?.hasAccess, generationUsage?.hasAccess, contentAccessLoading, usageLoading]);

  useEffect(() => {
    // Track article view when component mounts and user is signed in
    if (isSignedIn && article.articleId) {
      trackArticleView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, article.articleId]);

  useEffect(() => {
    // Initialize course information if article is part of a course
    if (article.courseArticles && article.courseArticles.length > 0) {
      const courseArticle = article.courseArticles[0];
      setCourseInfo({
        courseId: courseArticle.section.course.courseId,
        title: courseArticle.section.course.title,
        slug: courseArticle.section.course.slug,
        level: courseArticle.section.course.level,
      });
      
      // Check if user has completed this article in the course
      if (isSignedIn) {
        checkCourseProgress();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.courseArticles, isSignedIn]);

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
    setSubscriptionError(false);
    setIsStreaming(true);
    setStreamingContent('');
    setStreamingProgress(0);
    setStreamingMessage('Initializing generation...');
    setIsContentComplete(false);

    try {
      const response = await fetch(`/api/articles/${article.articleId}/generate/stream`);

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 403) {
          setSubscriptionError(true);
          throw new Error(data.error || "Access required");
        }
        if (response.status === 429) {
          // Usage limit reached
          throw new Error(data.error || "Daily generation limit reached");
        }
        throw new Error(data.error || "Failed to generate content");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream available");
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream ended naturally');
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'status':
                case 'progress':
                  setStreamingMessage(data.message);
                  setStreamingProgress(data.progress || 0);
                  break;
                  
                case 'content_chunk':
                  // Update the streaming content with the latest full content
                  setStreamingContent(data.content);
                  setStreamingMessage(data.message || 'Streaming content...');
                  break;
                  
                case 'content_complete':
                  setStreamingContent(data.content);
                  setStreamingMessage(data.message);
                  setStreamingProgress(data.progress || 95);
                  setIsContentComplete(true);
                  break;
                  
                case 'complete':
                  console.log('Received completion event:', data);
                  setArticle(data.article);
                  setStreamingMessage('Generation completed successfully!');
                  setStreamingProgress(100);
                  
                  // Close streaming after a brief delay to show completion
                  setTimeout(() => {
                    setIsStreaming(false);
                    setGenerating(false); // Ensure generating is set to false so article content shows
                  }, 1500);
                  return; // Exit the while loop early when complete
                  
                case 'error':
                  throw new Error(data.message);
              }
            } catch (parseError) {
              console.error('Failed to parse streaming data:', parseError);
            }
          }
        }
      }
      
      // If we get here, the stream ended without a complete event
      // This might happen if the stream closes before completion
      console.log('Stream ended without complete event, checking if content was generated');
      if (isContentComplete && streamingContent) {
        console.log('Content was generated, treating as complete');
        setStreamingMessage('Generation completed!');
        setStreamingProgress(100);
        // Update the article with the streamed content
        setArticle(prev => ({
          ...prev,
          contentHtml: streamingContent,
          isContentGenerated: true
        }));
        setTimeout(() => {
          setIsStreaming(false);
          setGenerating(false); // Ensure generating is set to false so article content shows
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsStreaming(false);
    } finally {
      setGenerating(false);
    }
  };

  const checkCourseProgress = async () => {
    if (!courseInfo) return;
    
    try {
      const response = await fetch(`/api/courses/${courseInfo.courseId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.isEnrolled && data.progress) {
          const articleProgress = data.progress.find((p: any) => p.articleId === article.articleId);
          setIsCompleted(articleProgress?.isCompleted || false);
        }
      }
    } catch (err) {
      console.error('Failed to check course progress:', err);
    }
  };

  const markAsComplete = async () => {
    if (!courseInfo || isMarkingComplete) return;

    try {
      setIsMarkingComplete(true);
      const response = await fetch(`/api/courses/${courseInfo.courseId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId: article.articleId,
          isCompleted: true,
          timeSpent: 5, // Assume 5 minutes for marking as complete
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark as complete');
      }

      setIsCompleted(true);
      
      // Show success message or feedback
      const data = await response.json();
      if (data.courseCompleted) {
        alert('Congratulations! You have completed the course!');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark as complete');
    } finally {
      setIsMarkingComplete(false);
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

      {/* Course Header */}
      {courseInfo && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              <div>
                <h2 className="text-sm font-medium text-blue-900">
                  Part of Course
                </h2>
                <Link 
                  href={`/courses/${courseInfo.courseId}`}
                  className="text-blue-700 hover:text-blue-800 font-medium"
                >
                  {courseInfo.title}
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isCompleted ? (
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Completed</span>
                </div>
              ) : (
                <button
                  onClick={markAsComplete}
                  disabled={isMarkingComplete}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isMarkingComplete ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Marking...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Mark Complete
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
        <div className="py-8">
          {isStreaming ? (
            <div className="space-y-4">
              {/* Compact Progress Header */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-3" />
                    <div>
                      <h3 className="text-sm font-medium text-blue-900">
                        Generating Article Content
                      </h3>
                      <p className="text-xs text-blue-700">{streamingMessage}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-blue-900">{Math.round(streamingProgress)}%</div>
                    <div className="w-24 bg-blue-200 rounded-full h-1.5 mt-1">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${streamingProgress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Streaming Content */}
              {streamingContent && (
                <div className="mb-12">
                  <div className="relative">
                    {/* Live indicator */}
                    <div className="absolute top-4 right-4 z-10">
                      <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center">
                        <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
                        LIVE
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="prose prose-lg max-w-none">
                      <MarkdownViewer content={streamingContent} removeFirstHeading={true} />
                    </div>
                    
                    {/* Typing indicator at the end - only show while actively generating */}
                    {!isContentComplete && (
                      <div className="flex items-center mt-4 text-gray-500">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                        <span className="ml-2 text-sm">AI is writing...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">Generating article content...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
            </div>
          )}
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
          
          {/* Suggestions Section */}
          {isSignedIn && suggestionsAccess && (
            <SuggestionsList articleId={article.articleId} currentUserId={user?.id} />
          )}
          
          {/* Comments Section */}
          <CommentsList articleId={article.articleId} />
        </>
      ) : (
        <div className="text-center py-20">
          <Sparkles className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Content Generation
          </h3>
          
          {/* Show loading state while checking access */}
          {(contentAccessLoading || usageLoading || isLoadingSubscription) ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-600">Checking access...</span>
            </div>
          ) : !isSignedIn ? (
            // User not signed in
            <>
              <p className="text-gray-600 mb-2">
                Sign in to generate article content
              </p>
              <p className="text-orange-600 mb-4 text-sm">
                You need to login to generate articles.
              </p>
              <Link
                href={signInWithRedirect}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Sign In to Generate Content
              </Link>
            </>
          ) : subscriptionError || !contentAccess?.hasAccess ? (
            // User has no access to feature at all
            <>
              <CreditCard className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Subscription Required
              </h3>
              <p className="text-gray-600 mb-4 max-w-md mx-auto">
                Article generation requires a subscription plan. Upgrade to unlock AI-generated content.
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
          ) : !generationUsage?.hasAccess ? (
            // User has access but hit usage limits
            <>
              <CreditCard className="mx-auto h-12 w-12 text-orange-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Article Generation Limit Reached
              </h3>
              <p className="text-gray-600 mb-2">
                You have used {generationUsage?.currentUsage || 0} of {generationUsage?.limit || 0} daily generations.
              </p>
              <p className="text-gray-600 mb-4 max-w-md mx-auto">
                Upgrade your plan for more daily generations or wait until tomorrow for your limit to reset.
              </p>
              <div className="space-y-3">
                <Link
                  href="/pricing"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  Upgrade for More Generations
                </Link>
                <p className="text-sm text-gray-500">
                  Limits reset daily at midnight UTC
                </p>
              </div>
            </>
          ) : (
            // User has access and usage available
            <>
              <p className="text-gray-600 mb-2">
                This article&apos;s content will be generated with AI
              </p>
              {generationUsage && (
                <p className="text-sm text-gray-500 mb-4">
                  {generationUsage.remaining} of {generationUsage.limit} daily generations remaining
                </p>
              )}
              <button
                onClick={generateContent}
                disabled={generating}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  'Generate Content'
                )}
              </button>
            </>
          )}
          
          {/* Show error message */}
          {error && !subscriptionError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
    
    {/* Floating Action Menu */}
    {isSignedIn && <FloatingActionMenu articleId={article.articleId} currentExampleId={focusedExampleId || undefined} />}
    </>
  );
}

interface MoreOptionsDropdownProps {
  articleId: string;
  articleTitle: string;
  isFlagged: boolean;
}

function MoreOptionsDropdown({ articleId, articleTitle, isFlagged }: MoreOptionsDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);

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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Manage Lists clicked');
                    setShowDropdown(false);
                    setShowListModal(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <BookmarkPlus className="h-4 w-4 mr-2" />
                  Manage Lists
                </button>
                <div className="border-t border-gray-100">
                  <FlagButtonMenuItem
                    articleId={articleId}
                    isFlagged={isFlagged}
                    onClose={() => setShowDropdown(false)}
                    onShowModal={() => {
                      setShowDropdown(false);
                      setShowFlagModal(true);
                    }}
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

      {showFlagModal && (
        <FlagModal
          articleId={articleId}
          isFlagged={isFlagged}
          isOpen={showFlagModal}
          onClose={() => setShowFlagModal(false)}
        />
      )}
    </>
  );
}

interface FlagButtonMenuItemProps {
  articleId: string;
  isFlagged: boolean;
  onClose: () => void;
  onShowModal: () => void;
}

function FlagButtonMenuItem({ isFlagged, onShowModal }: FlagButtonMenuItemProps) {
  const { isSignedIn } = useUser();

  async function handleFlag() {
    if (!isSignedIn) {
      alert("Please sign in to flag content");
      return;
    }

    if (isFlagged) {
      alert("This content has already been flagged");
      return;
    }

    onShowModal();
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleFlag();
      }}
      disabled={isFlagged}
      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center disabled:opacity-50"
      title={isFlagged ? "Already flagged" : "Flag as inappropriate"}
    >
      <Flag className="h-4 w-4 mr-2" fill={isFlagged ? "currentColor" : "none"} />
      <span>{isFlagged ? "Flagged" : "Flag"}</span>
    </button>
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
              <p className="text-sm text-gray-600 mt-1">Add &ldquo;{articleTitle}&rdquo; to your lists</p>
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


interface FlagModalProps {
  articleId: string;
  isFlagged: boolean;
  isOpen: boolean;
  onClose: () => void;
}

function FlagModal({ articleId, isOpen, onClose }: FlagModalProps) {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [flagReason, setFlagReason] = useState("");

  async function submitFlag() {
    try {
      setLoading(true);
      const response = await fetch(`/api/articles/${articleId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagReason }),
      });

      if (!response.ok) throw new Error("Failed to flag content");
      
      onClose();
      setFlagReason("");
      // Refresh the page to show the flagged status
      window.location.reload();
    } catch (error) {
      console.error("Error flagging content:", error);
      alert("Failed to flag content");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen || !isSignedIn) return null;

  return (
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
              onClose();
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
  );
}

