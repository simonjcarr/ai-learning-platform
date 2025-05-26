"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { MessageSquare, Loader2 } from "lucide-react";
import CommentForm from "./comment-form";
import Comment from "./comment";

interface CommentsListProps {
  articleId: string;
}

export default function CommentsList({ articleId }: CommentsListProps) {
  const { isSignedIn } = useUser();
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/articles/${articleId}/comments`);
      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }
      const data = await response.json();
      setComments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [articleId]);

  const handleCommentAdded = () => {
    fetchComments();
  };

  return (
    <div className="mt-12 border-t border-gray-200 pt-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />
          Comments
        </h2>
      </div>

      {isSignedIn && (
        <div className="mb-8">
          <CommentForm
            articleId={articleId}
            onSuccess={handleCommentAdded}
          />
        </div>
      )}

      {!isSignedIn && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-sm text-gray-600">
            Please sign in to leave a comment.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-0">
          {comments.map((comment) => (
            <Comment
              key={comment.commentId}
              comment={comment}
              articleId={articleId}
              onCommentDeleted={handleCommentAdded}
            />
          ))}
        </div>
      )}
    </div>
  );
}