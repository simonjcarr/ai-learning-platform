"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookmarkIcon, Loader2, Plus, Trash2, Edit2, Globe, Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CuratedList {
  listId: string;
  listName: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    items: number;
  };
}

export default function CuratedListsPage() {
  const [lists, setLists] = useState<CuratedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [editingList, setEditingList] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    try {
      const response = await fetch("/api/lists");
      if (response.ok) {
        const data = await response.json();
        setLists(data);
      }
    } catch (error) {
      console.error("Error fetching lists:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listName: newListName,
          description: newListDescription || null,
        }),
      });

      if (response.ok) {
        setNewListName("");
        setNewListDescription("");
        setShowNewListForm(false);
        fetchLists();
      }
    } catch (error) {
      console.error("Error creating list:", error);
    }
  };

  const handleUpdateList = async (listId: string) => {
    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listName: editName,
          description: editDescription || null,
        }),
      });

      if (response.ok) {
        setEditingList(null);
        fetchLists();
      }
    } catch (error) {
      console.error("Error updating list:", error);
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm("Are you sure you want to delete this list?")) return;

    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchLists();
      }
    } catch (error) {
      console.error("Error deleting list:", error);
    }
  };

  const handleTogglePublic = async (listId: string, currentIsPublic: boolean) => {
    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isPublic: !currentIsPublic,
        }),
      });

      if (response.ok) {
        fetchLists();
      }
    } catch (error) {
      console.error("Error updating list visibility:", error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BookmarkIcon className="h-8 w-8 text-blue-600" />
            My Lists
          </h1>
          <p className="mt-2 text-gray-600">
            Create and manage your curated article collections
          </p>
        </div>
        <button
          onClick={() => setShowNewListForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New List
        </button>
      </div>

      {showNewListForm && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New List</h3>
          <form onSubmit={handleCreateList}>
            <div className="mb-4">
              <label htmlFor="listName" className="block text-sm font-medium text-gray-700">
                List Name
              </label>
              <input
                type="text"
                id="listName"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="My Reading List"
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="listDescription" className="block text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <textarea
                id="listDescription"
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Articles I want to read later"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Create List
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewListForm(false);
                  setNewListName("");
                  setNewListDescription("");
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : lists.length === 0 ? (
        <div className="text-center py-12">
          <BookmarkIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No lists yet
          </h3>
          <p className="mt-2 text-gray-600">
            Create your first list to start organizing articles
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <div
              key={list.listId}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              {editingList === list.listId ? (
                <div className="p-6">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full mb-4 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateList(list.listId)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingList(null)}
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Link href={`/dashboard/lists/${list.listId}`} className="block p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {list.listName}
                    </h3>
                    {list.description && (
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                        {list.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{list._count.items} articles</span>
                      <span className="text-xs">
                        Updated {formatDistanceToNow(new Date(list.updatedAt), { addSuffix: true })}
                      </span>
                    </div>
                  </Link>
                  <div className="px-6 pb-4 border-t flex items-center justify-between">
                    <button
                      onClick={() => handleTogglePublic(list.listId, list.isPublic)}
                      className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                      title={list.isPublic ? "Make private" : "Make public"}
                    >
                      {list.isPublic ? (
                        <Globe className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      <span>{list.isPublic ? "Public" : "Private"}</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingList(list.listId);
                          setEditName(list.listName);
                          setEditDescription(list.description || "");
                        }}
                        className="text-gray-600 hover:text-gray-900"
                        title="Edit list"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteList(list.listId)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete list"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}