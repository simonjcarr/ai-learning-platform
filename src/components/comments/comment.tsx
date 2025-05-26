"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { MessageCircle, Trash2, User } from "lucide-react";
import Image from "next/image";
import CommentForm from "./comment-form";

interface CommentUser {
  clerkUserId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

interface CommentData {
  commentId: string;
  content: string;
  createdAt: string;
  user: CommentUser;
  replies?: CommentData[];
}

interface CommentProps {
  comment: CommentData;
  articleId: string;
  onCommentDeleted: () => void;
  depth?: number;
}

export default function Comment({ 
  comment, 
  articleId, 
  onCommentDeleted,
  depth = 0 
}: CommentProps) {
  const { user } = useUser();
  const [isReplying, setIsReplying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = user?.id === comment.user.clerkUserId;
  const maxDepth = 3; // Limit nesting depth

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/comments/${comment.commentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }

      onCommentDeleted();
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("Failed to delete comment");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className={`${depth > 0 ? 'ml-8 pt-3' : 'py-4'} ${depth === 0 ? 'border-b border-gray-200' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {comment.user.imageUrl ? (
            <Image
              src={comment.user.imageUrl}
              alt={`${comment.user.firstName || 'User'} avatar`}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900">
              {comment.user.firstName && comment.user.lastName 
                ? `${comment.user.firstName} ${comment.user.lastName}`
                : comment.user.firstName || comment.user.lastName || comment.user.username || "User"
              }
            </span>
            <span className="text-xs text-gray-500">
              {formatDate(comment.createdAt)}
            </span>
          </div>
          
          <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
            {comment.content}
          </div>
          
          <div className="flex items-center gap-3 mt-2">
            {depth < maxDepth && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <MessageCircle className="w-3 h-3" />
                Reply
              </button>
            )}
            
            {isAuthor && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
          
          {isReplying && (
            <div className="mt-3">
              <CommentForm
                articleId={articleId}
                parentId={comment.commentId}
                onSuccess={() => {
                  setIsReplying(false);
                  onCommentDeleted(); // Refresh comments
                }}
                onCancel={() => setIsReplying(false)}
                placeholder="Write a reply..."
              />
            </div>
          )}
          
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3">
              {comment.replies.map((reply) => (
                <Comment
                  key={reply.commentId}
                  comment={reply}
                  articleId={articleId}
                  onCommentDeleted={onCommentDeleted}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}