"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Role } from "@prisma/client";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import MarkdownViewer from "@/components/markdown-viewer";

interface PageProps {
  params: Promise<{ articleId: string }>;
}

interface Article {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  contentHtml: string | null;
  categoryId: string | null;
  streamId: string | null;
  category: {
    categoryId: string;
    categoryName: string;
  } | null;
  stream: {
    streamId: string;
    streamName: string;
  } | null;
}

interface Category {
  categoryId: string;
  categoryName: string;
}

interface Tag {
  tagId: string;
  tagName: string;
  description: string | null;
  color: string | null;
}

export default function EditArticlePage({ params }: PageProps) {
  const { articleId } = use(params);
  const router = useRouter();
  const { hasMinRole, isLoadingRole } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [, setArticleTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoadingRole && !hasMinRole(Role.EDITOR)) {
      router.push("/dashboard");
    }
  }, [isLoadingRole, hasMinRole, router]);

  useEffect(() => {
    if (!isLoadingRole && hasMinRole(Role.EDITOR)) {
      fetchArticle();
      fetchCategories();
      fetchAllTags();
      fetchArticleTags();
    }
  }, [articleId, isLoadingRole]);

  async function fetchArticle() {
    try {
      console.log("Fetching article with ID:", articleId);
      const response = await fetch(`/api/admin/articles/${articleId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch article: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Article data:", data);
      
      setArticle(data);
      setTitle(data.articleTitle);
      setSlug(data.articleSlug);
      setContent(data.contentHtml || "");
      setCategoryId(data.categoryId || "");
    } catch (error) {
      console.error("Error fetching article:", error);
      setError(error instanceof Error ? error.message : "Failed to load article");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }

  async function fetchAllTags() {
    try {
      const response = await fetch("/api/admin/tags");
      if (!response.ok) throw new Error("Failed to fetch tags");
      
      const data = await response.json();
      setAllTags(data);
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  }

  async function fetchArticleTags() {
    try {
      const response = await fetch(`/api/admin/articles/${articleId}/tags`);
      if (!response.ok) throw new Error("Failed to fetch article tags");
      
      const data = await response.json();
      setArticleTags(data);
      setSelectedTagIds(data.map((tag: Tag) => tag.tagId));
    } catch (error) {
      console.error("Error fetching article tags:", error);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    
    try {
      // Save article details
      const articleResponse = await fetch(`/api/admin/articles/${articleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleTitle: title,
          articleSlug: slug,
          contentHtml: content,
          categoryId: categoryId || null,
        }),
      });
      
      if (!articleResponse.ok) {
        const data = await articleResponse.json();
        throw new Error(data.error || "Failed to save article");
      }

      // Save tags
      const tagsResponse = await fetch(`/api/admin/articles/${articleId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagIds: selectedTagIds,
        }),
      });
      
      if (!tagsResponse.ok) {
        const data = await tagsResponse.json();
        throw new Error(data.error || "Failed to save tags");
      }
      
      router.push("/admin/articles");
    } catch (error) {
      console.error("Error saving article:", error);
      setError(error instanceof Error ? error.message : "Failed to save article");
    } finally {
      setSaving(false);
    }
  }

  function generateSlug() {
    const newSlug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    setSlug(newSlug);
  }

  function handleTagToggle(tagId: string) {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  }

  if (isLoadingRole || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Article not found</p>
        <button
          onClick={() => router.push("/admin/articles")}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          Back to articles
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/admin/articles")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to articles
        </button>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold mb-6">Edit Article</h1>
        
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {showPreview ? (
          <div className="prose prose-sm max-w-none">
            <h2 className="text-xl font-semibold mb-4">{title}</h2>
            <MarkdownViewer content={content} />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slug
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <button
                  onClick={generateSlug}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Generate
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.categoryId} value={category.categoryId}>
                    {category.categoryName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                {allTags.length === 0 ? (
                  <p className="text-gray-500 text-sm">No tags available</p>
                ) : (
                  <div className="space-y-2">
                    {allTags.map((tag) => (
                      <label key={tag.tagId} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTagIds.includes(tag.tagId)}
                          onChange={() => handleTagToggle(tag.tagId)}
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span className="flex items-center space-x-2">
                          {tag.color && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                          )}
                          <span className="text-sm">{tag.tagName}</span>
                          {tag.description && (
                            <span className="text-xs text-gray-500">({tag.description})</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Select the tags that apply to this article
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content (Markdown)
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="Enter article content in Markdown format..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Use Markdown syntax for formatting. Click Preview to see rendered content.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}