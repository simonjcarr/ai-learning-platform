"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import {
  useFloating,
  autoUpdate,
  flip,
  offset,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import { 
  MessageCircle, 
  FolderOpen, 
  Plus, 
  MoreVertical,
  Loader2,
  Lock,
  X,
  Send,
  Trash2,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChatMessage } from "./chat/chat-message";

interface FloatingActionMenuProps {
  articleId: string;
  currentExampleId?: string;
}

interface Message {
  messageId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
  exampleId?: string | null;
}

interface ArticleGroup {
  groupId: string;
  name: string;
  articles: {
    id: string;
    scrollPosition: number;
    lastViewedAt: string | null;
    article: {
      articleId: string;
      articleTitle: string;
      articleSlug: string;
    };
  }[];
}

type MenuAction = 'chat' | 'groups';

export function FloatingActionMenu({ articleId, currentExampleId }: FloatingActionMenuProps) {
  const { isSignedIn } = useAuth();
  const { isLoaded } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  
  // Main menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<MenuAction | null>(null);
  
  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{ canUseAI: boolean; loading: boolean }>({ canUseAI: false, loading: true });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Groups state
  const [groups, setGroups] = useState<ArticleGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [currentArticleId, setCurrentArticleId] = useState<string | null>(null);

  // Extract article slug from pathname
  const articleMatch = pathname.match(/^\/articles\/([^\/]+)/);
  const currentArticleSlug = articleMatch ? decodeURIComponent(articleMatch[1]) : null;

  const { refs, floatingStyles, context } = useFloating({
    open: isMenuOpen,
    onOpenChange: setIsMenuOpen,
    middleware: [offset(10), flip(), shift()],
    whileElementsMounted: autoUpdate,
    placement: "top-end",
  });

  const hover = useHover(context, { 
    move: false,
    delay: { open: 100, close: 300 }
  });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);


  // Chat functions
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isChatOpen && isSignedIn) {
      checkSubscriptionStatus();
      fetchChatHistory();
    }
  }, [isChatOpen, isSignedIn]);

  const checkSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/subscription/status');
      if (response.ok) {
        const data = await response.json();
        const canUseAI = data.tier === 'STANDARD' || data.tier === 'MAX';
        setSubscriptionStatus({ canUseAI, loading: false });
      } else {
        setSubscriptionStatus({ canUseAI: false, loading: false });
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setSubscriptionStatus({ canUseAI: false, loading: false });
    }
  };

  const fetchChatHistory = async () => {
    setIsFetchingHistory(true);
    try {
      const response = await fetch(`/api/articles/${articleId}/chat`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading || !isSignedIn) return;

    const userInput = input.trim();
    setInput('');
    
    const tempUserMessage: Message = {
      messageId: `temp-user-${Date.now()}`,
      role: 'USER',
      content: userInput,
      createdAt: new Date().toISOString(),
      exampleId: currentExampleId,
    };
    
    setMessages(prev => [...prev, tempUserMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/articles/${articleId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: userInput,
          exampleId: currentExampleId,
        }),
      });

      if (response.ok) {
        const { userMessage, assistantMessage } = await response.json();
        setMessages(prev => {
          const filtered = prev.filter(msg => msg.messageId !== tempUserMessage.messageId);
          return [...filtered, userMessage, assistantMessage];
        });
      } else {
        setMessages(prev => prev.filter(msg => msg.messageId !== tempUserMessage.messageId));
        
        if (response.status === 403) {
          setSubscriptionStatus({ canUseAI: false, loading: false });
        }
        
        const errorData = await response.json();
        console.error('Failed to send message:', errorData.error);
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => msg.messageId !== tempUserMessage.messageId));
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Groups functions
  useEffect(() => {
    if (currentArticleSlug) {
      setCurrentArticleId(null);
      fetch(`/api/articles?slug=${currentArticleSlug}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.length > 0) {
            const articleId = data[0].articleId;
            setCurrentArticleId(articleId);
            
            const storedScrollPosition = sessionStorage.getItem(`article-scroll-${articleId}`);
            if (storedScrollPosition) {
              const scrollPos = parseInt(storedScrollPosition, 10);
              sessionStorage.removeItem(`article-scroll-${articleId}`);
              
              const attemptScroll = (attempts = 0) => {
                if (attempts > 20) return;
                
                if (document.body.scrollHeight > window.innerHeight) {
                  window.scrollTo({ top: scrollPos, behavior: "instant" });
                  
                  groups.forEach((group) => {
                    const article = group.articles.find((a) => a.article.articleId === articleId);
                    if (article) {
                      fetch(`/api/article-groups/${group.groupId}/articles/${articleId}/scroll`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ scrollPosition: scrollPos }),
                      });
                    }
                  });
                } else {
                  setTimeout(() => attemptScroll(attempts + 1), 100);
                }
              };
              
              setTimeout(() => attemptScroll(), 100);
            }
          }
        })
        .catch((error) => console.error("Error fetching article:", error));
    } else {
      setCurrentArticleId(null);
    }
  }, [pathname, currentArticleSlug, groups]);

  const fetchGroups = async () => {
    setGroupsLoading(true);
    try {
      const response = await fetch("/api/article-groups");
      if (!response.ok) throw new Error("Failed to fetch groups");
      const data = await response.json();
      setGroups(data);
    } catch {
      toast.error("Failed to load article groups");
    } finally {
      setGroupsLoading(false);
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim() || creating) return;
    
    if (!isSignedIn) {
      toast.error("Please sign in to create article groups");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/article-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create group");
      }
      
      await fetchGroups();
      setNewGroupName("");
      setShowNewGroupInput(false);
      toast.success("Group created successfully");
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      const response = await fetch(`/api/article-groups/${groupId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete group");
      
      await fetchGroups();
      toast.success("Group deleted successfully");
    } catch {
      toast.error("Failed to delete group");
    }
  };

  const addCurrentArticleToGroup = async (groupId: string) => {
    if (!currentArticleId) {
      toast.error("No article selected");
      return;
    }

    try {
      const response = await fetch(`/api/article-groups/${groupId}/articles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: currentArticleId }),
      });

      if (response.status === 409) {
        toast.info("Article already in group");
        return;
      }

      if (!response.ok) throw new Error("Failed to add article");
      
      await fetchGroups();
      toast.success("Article added to group");
    } catch {
      toast.error("Failed to add article to group");
    }
  };

  const removeArticleFromGroup = async (groupId: string, articleId: string) => {
    try {
      const response = await fetch(
        `/api/article-groups/${groupId}/articles?articleId=${articleId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to remove article");
      
      await fetchGroups();
      toast.success("Article removed from group");
    } catch {
      toast.error("Failed to remove article from group");
    }
  };

  const saveScrollPosition = async (groupId: string, articleId: string) => {
    const scrollPosition = window.scrollY;
    
    try {
      await fetch(`/api/article-groups/${groupId}/articles/${articleId}/scroll`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scrollPosition }),
      });
    } catch (error) {
      console.error("Failed to save scroll position:", error);
    }
  };

  const navigateToArticle = async (
    groupId: string,
    articleId: string,
    articleSlug: string,
    scrollPosition: number
  ) => {
    if (currentArticleId && currentArticleId !== articleId) {
      const currentGroup = groups.find((g) =>
        g.articles.some((a) => a.article.articleId === currentArticleId)
      );
      if (currentGroup) {
        await saveScrollPosition(currentGroup.groupId, currentArticleId);
      }
    }

    sessionStorage.setItem(`article-scroll-${articleId}`, scrollPosition.toString());
    router.push(`/articles/${articleSlug}`);
  };

  // Menu action handlers
  const handleMenuAction = (action: MenuAction) => {
    setActiveAction(action);
    setIsMenuOpen(false);
    
    if (action === 'chat') {
      setIsChatOpen(true);
    } else if (action === 'groups') {
      fetchGroups();
    }
  };

  const closeAllActions = () => {
    setActiveAction(null);
    setIsChatOpen(false);
    setShowNewGroupInput(false);
    setExpandedGroup(null);
  };

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <>
      {/* Floating multi-action button */}
      <Button
        ref={refs.setReference}
        className="fixed bottom-4 right-4 z-40 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-black hover:bg-gray-800 text-white border-0"
        size="icon"
        {...getReferenceProps()}
        title="Actions Menu"
      >
        <MoreVertical className="h-6 w-6" />
      </Button>

      {/* Menu popup */}
      {isMenuOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="p-2 space-y-1">
              <Button
                onClick={() => handleMenuAction('chat')}
                className="w-full justify-start gap-3 text-left bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 border-0 transition-colors"
                size="sm"
              >
                <MessageCircle className="h-4 w-4" />
                AI Chat
              </Button>
              <Button
                onClick={() => handleMenuAction('groups')}
                className="w-full justify-start gap-3 text-left bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 border-0 transition-colors"
                size="sm"
              >
                <FolderOpen className="h-4 w-4" />
                Article Groups
              </Button>
            </div>
          </div>
        </FloatingPortal>
      )}

      {/* Chat interface */}
      {isChatOpen && (
        <div className="fixed bottom-0 right-0 w-full sm:w-96 h-[600px] bg-white dark:bg-gray-900 shadow-2xl rounded-t-lg sm:rounded-tl-lg border border-gray-200 dark:border-gray-700 z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-gray-700 dark:text-gray-200" />
              <h3 className="font-semibold">AI Tutor</h3>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {subscriptionStatus.loading || isFetchingHistory ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : !subscriptionStatus.canUseAI ? (
              <div className="text-center mt-8 px-4">
                <Lock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">AI Chat is a Premium Feature</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Upgrade to Standard or Max plan to get unlimited access to our AI tutor who can help you understand concepts and answer questions about the articles.
                </p>
                <button
                  onClick={() => router.push('/pricing')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Pricing Plans
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-sm">Ask me anything about this article!</p>
                {currentExampleId && (
                  <p className="text-xs mt-2">I can help you understand this quiz question.</p>
                )}
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage
                    key={message.messageId}
                    role={message.role}
                    content={message.content}
                    createdAt={message.createdAt}
                  />
                ))}
                {isLoading && (
                  <div className="flex justify-start mb-4">
                    <div className="max-w-[70%] rounded-lg px-4 py-2 bg-gray-100 dark:bg-gray-800">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                        <span className="text-sm text-gray-500">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {subscriptionStatus.canUseAI && (
            <form onSubmit={handleChatSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSubmit(e);
                    }
                  }}
                  placeholder="Ask a question..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-none"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Groups interface */}
      {activeAction === 'groups' && (
        <div className="fixed bottom-0 right-0 w-full sm:w-96 h-[600px] bg-white dark:bg-gray-900 shadow-2xl rounded-t-lg sm:rounded-tl-lg border border-gray-200 dark:border-gray-700 z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-gray-700 dark:text-gray-200" />
              <h3 className="font-semibold text-gray-100">Article Groups</h3>
            </div>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowNewGroupInput(!showNewGroupInput)}
                className="hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Create new group"
              >
                <Plus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </Button>
              <button
                onClick={closeAllActions}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close groups"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {showNewGroupInput && (
              <form onSubmit={(e) => { e.preventDefault(); createGroup(); }} className="mb-4 flex gap-2">
                <Input
                  placeholder="Group name..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button 
                  size="sm" 
                  type="submit"
                  disabled={!newGroupName.trim() || creating}
                  className="bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 text-white disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add"
                  )}
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowNewGroupInput(false);
                    setNewGroupName("");
                  }}
                  className="hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="h-4 w-4" />
                </Button>
              </form>
            )}

            {groupsLoading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-sm">No groups yet.</p>
                <p className="text-sm">Click the + button to create one!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <GroupItem
                    key={group.groupId}
                    group={group}
                    currentArticleId={currentArticleId}
                    currentArticleSlug={currentArticleSlug}
                    onDelete={deleteGroup}
                    onAddCurrentArticle={addCurrentArticleToGroup}
                    onRemoveArticle={removeArticleFromGroup}
                    onNavigateToArticle={navigateToArticle}
                    isExpanded={expandedGroup === group.groupId}
                    onToggleExpand={(groupId) => setExpandedGroup(expandedGroup === groupId ? null : groupId)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Group item component (same as original but extracted)
interface GroupItemProps {
  group: ArticleGroup;
  currentArticleId: string | null;
  currentArticleSlug: string | null;
  onDelete: (groupId: string) => void;
  onAddCurrentArticle: (groupId: string) => void;
  onRemoveArticle: (groupId: string, articleId: string) => void;
  onNavigateToArticle: (
    groupId: string,
    articleId: string,
    articleSlug: string,
    scrollPosition: number
  ) => void;
  isExpanded: boolean;
  onToggleExpand: (groupId: string) => void;
}

function GroupItem({
  group,
  currentArticleId,
  currentArticleSlug,
  onDelete,
  onAddCurrentArticle,
  onRemoveArticle,
  onNavigateToArticle,
  isExpanded,
  onToggleExpand,
}: GroupItemProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer group transition-colors"
        onClick={() => onToggleExpand(group.groupId)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ChevronRight 
            className={`h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`} 
          />
          <span className="truncate text-gray-900 dark:text-gray-100">{group.name}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            ({group.articles.length})
          </span>
        </div>
        <div className="flex gap-1">
          {currentArticleId && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
              onClick={(e) => {
                e.stopPropagation();
                onAddCurrentArticle(group.groupId);
              }}
              title="Add current article to this group"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(group.groupId);
            }}
            title="Delete this group"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isExpanded && group.articles.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
            {group.articles.map((item) => {
              const isCurrentArticle = item.article.articleId === currentArticleId || 
                                     (currentArticleSlug && item.article.articleSlug === currentArticleSlug);
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer group/article transition-colors ${
                    isCurrentArticle 
                      ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800' 
                      : 'hover:bg-white dark:hover:bg-gray-800'
                  }`}
                  onClick={() =>
                    onNavigateToArticle(
                      group.groupId,
                      item.article.articleId,
                      item.article.articleSlug,
                      item.scrollPosition
                    )
                  }
                >
                  <span className={`text-sm truncate flex-1 pl-6 ${
                    isCurrentArticle 
                      ? 'text-blue-700 dark:text-blue-300 font-medium' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {item.article.articleTitle}
                  </span>
                <button
                  className="h-7 w-7 flex items-center justify-center text-gray-100 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors ml-2 flex-shrink-0 bg-gray-700/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveArticle(group.groupId, item.article.articleId);
                  }}
                  title="Remove from group"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              );
            })}
          </div>
        </div>
      )}
      
      {isExpanded && group.articles.length === 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          No articles in this group yet
        </div>
      )}
    </div>
  );
}