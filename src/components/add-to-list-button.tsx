"use client";

import { useState, useEffect } from "react";
import { BookmarkPlus, Check, Loader2, Plus, X } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

interface AddToListButtonProps {
  articleId: string;
  articleTitle: string;
  className?: string;
  iconOnly?: boolean;
}

interface CuratedList {
  listId: string;
  listName: string;
  description: string | null;
  _count?: {
    items: number;
  };
}

export default function AddToListButton({ 
  articleId, 
  articleTitle,
  className = "",
  iconOnly = false
}: AddToListButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [lists, setLists] = useState<CuratedList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [addedToLists, setAddedToLists] = useState<Set<string>>(new Set());
  const [articleLists, setArticleLists] = useState<Set<string>>(new Set());
  const { isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn && showDropdown) {
      fetchLists();
    }
  }, [isSignedIn, showDropdown]);

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
          setAddedToLists(new Set([...addedToLists, listId]));
          setTimeout(() => {
            setAddedToLists(prev => {
              const newSet = new Set(prev);
              newSet.delete(listId);
              return newSet;
            });
          }, 2000);
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

  const handleButtonClick = () => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
    setShowDropdown(!showDropdown);
  };

  return (
    <div className="relative">
      <button
        onClick={handleButtonClick}
        className={`inline-flex items-center ${iconOnly ? "justify-center p-2" : "gap-2 px-3 py-2"} text-sm font-medium rounded-md transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 ${className}`}
        title="Add to list"
      >
        <BookmarkPlus className="h-4 w-4" />
        {!iconOnly && <span>Add to List</span>}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
          <div className="p-2">
            <h3 className="text-sm font-semibold text-gray-900 px-2 py-1">
              Save to list
            </h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              </div>
            ) : (
              <>
                <div className="max-h-48 overflow-y-auto">
                  {lists.map((list) => (
                    <button
                      key={list.listId}
                      onClick={() => handleToggleList(list.listId)}
                      className="w-full text-left px-2 py-2 text-sm rounded hover:bg-gray-100 flex items-center justify-between group"
                    >
                      <span className="truncate">{list.listName}</span>
                      <div className="flex items-center gap-1">
                        {articleLists.has(list.listId) && (
                          <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )}
                        {addedToLists.has(list.listId) && (
                          <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )}
                        {articleLists.has(list.listId) && (
                          <X className="h-4 w-4 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {!showNewListForm ? (
                  <button
                    onClick={() => setShowNewListForm(true)}
                    className="w-full text-left px-2 py-2 text-sm rounded hover:bg-gray-100 flex items-center text-blue-600 mt-2 border-t"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create new list
                  </button>
                ) : (
                  <form onSubmit={handleCreateNewList} className="mt-2 border-t pt-2">
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="List name"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="submit"
                        className="flex-1 px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewListForm(false);
                          setNewListName("");
                        }}
                        className="flex-1 px-2 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}