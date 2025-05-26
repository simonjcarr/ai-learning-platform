"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2, Send } from "lucide-react";

interface CommentFormProps {
  articleId: string;
  parentId?: string;
  onSuccess: () => void;
  onCancel?: () => void;
  placeholder?: string;
}

export default function CommentForm({ 
  articleId, 
  parentId, 
  onSuccess, 
  onCancel,
  placeholder = "Write a comment..."
}: CommentFormProps) {
  const { isSignedIn } = useUser();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSignedIn) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError("Please enter a comment");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/articles/${articleId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: content.trim(),
          parentId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to post comment");
      }

      setContent("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={parentId ? 2 : 3}
          disabled={isSubmitting}
        />
      </div>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <Send className="w-3 h-3 mr-1.5" />
              Post
            </>
          )}
        </button>
        
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}