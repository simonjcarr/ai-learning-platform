"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
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
import { FolderOpen, Plus, Trash2, X, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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

export function ArticleGroupsButton() {
  const { isSignedIn, isLoaded } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [groups, setGroups] = useState<ArticleGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [currentArticleId, setCurrentArticleId] = useState<string | null>(null);

  // Extract article slug from pathname - this will update when pathname changes
  const articleMatch = pathname.match(/^\/articles\/([^\/]+)/);
  const currentArticleSlug = articleMatch ? articleMatch[1] : null;

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(10), flip(), shift()],
    whileElementsMounted: autoUpdate,
    placement: "top-start",
  });

  const hover = useHover(context, { 
    move: false,
    delay: { open: 100, close: 300 } // Add delay to prevent immediate closing
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

  // Fetch current article ID if on article page
  useEffect(() => {
    console.log("Pathname changed:", pathname);
    console.log("Current article slug:", currentArticleSlug);
    
    if (currentArticleSlug) {
      setCurrentArticleId(null); // Reset while loading
      fetch(`/api/articles?slug=${currentArticleSlug}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.length > 0) {
            const articleId = data[0].articleId;
            setCurrentArticleId(articleId);
            console.log("Set current article ID to:", articleId, "for slug:", currentArticleSlug);
            
            // Check if we have a stored scroll position for this article
            const storedScrollPosition = sessionStorage.getItem(`article-scroll-${articleId}`);
            if (storedScrollPosition) {
              const scrollPos = parseInt(storedScrollPosition, 10);
              sessionStorage.removeItem(`article-scroll-${articleId}`);
              
              // Wait for the page to render, then scroll
              const attemptScroll = (attempts = 0) => {
                if (attempts > 20) return; // Give up after 2 seconds
                
                // Check if the page has content and is ready
                if (document.body.scrollHeight > window.innerHeight) {
                  window.scrollTo({ top: scrollPos, behavior: "instant" });
                  
                  // Update last viewed time in the group
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
                  // Try again in 100ms
                  setTimeout(() => attemptScroll(attempts + 1), 100);
                }
              };
              
              // Start attempting to scroll after a short delay
              setTimeout(() => attemptScroll(), 100);
            }
          }
        })
        .catch((error) => console.error("Error fetching article:", error));
    } else {
      setCurrentArticleId(null);
    }
  }, [pathname, currentArticleSlug, groups]); // Depend on pathname to ensure updates

  // Fetch article groups
  useEffect(() => {
    if (isOpen) {
      fetchGroups();
    }
  }, [isOpen]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/article-groups");
      if (!response.ok) throw new Error("Failed to fetch groups");
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      toast.error("Failed to load article groups");
    } finally {
      setLoading(false);
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
      
      const newGroup = await response.json();
      console.log("Created group:", newGroup);
      
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
    } catch (error) {
      toast.error("Failed to delete group");
    }
  };

  const addCurrentArticleToGroup = async (groupId: string) => {
    console.log("Adding article to group. Current article ID:", currentArticleId);
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
    } catch (error) {
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
    } catch (error) {
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
    // Save current scroll position if on an article page
    if (currentArticleId && currentArticleId !== articleId) {
      const currentGroup = groups.find((g) =>
        g.articles.some((a) => a.article.articleId === currentArticleId)
      );
      if (currentGroup) {
        await saveScrollPosition(currentGroup.groupId, currentArticleId);
      }
    }

    // Store scroll position in sessionStorage before navigation
    sessionStorage.setItem(`article-scroll-${articleId}`, scrollPosition.toString());

    // Navigate to the article
    router.push(`/articles/${articleSlug}`);
  };

  // Don't render until auth is loaded
  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <>
      <Button
        ref={refs.setReference}
        className="fixed bottom-5 right-20 z-50 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600"
        size="icon"
        {...getReferenceProps()}
        title="Article Groups"
      >
        <FolderOpen className="h-5 w-5" />
      </Button>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 w-72 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Article Groups</h3>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowNewGroupInput(!showNewGroupInput)}
                className="hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Create new group"
              >
                <Plus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </Button>
            </div>

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
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
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

            {loading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
            ) : groups.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-sm">No groups yet.</p>
                <p className="text-sm">Click the + button to create one!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {groups.map((group) => (
                  <GroupItem
                    key={group.groupId}
                    group={group}
                    currentArticleId={currentArticleId}
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
        </FloatingPortal>
      )}
    </>
  );
}

interface GroupItemProps {
  group: ArticleGroup;
  currentArticleId: string | null;
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
              className="h-7 w-7 hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
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
            {group.articles.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 cursor-pointer group/article transition-colors"
                onClick={() =>
                  onNavigateToArticle(
                    group.groupId,
                    item.article.articleId,
                    item.article.articleSlug,
                    item.scrollPosition
                  )
                }
              >
                <span className="text-sm truncate flex-1 text-gray-700 dark:text-gray-300 pl-6">
                  {item.article.articleTitle}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 opacity-0 group-hover/article:opacity-100 transition-opacity ml-2 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveArticle(group.groupId, item.article.articleId);
                  }}
                  title="Remove from group"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
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