'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, User, Bot } from 'lucide-react';
import { CourseCommentForm } from './course-comment-form';

interface CourseCommentProps {
  comment: {
    commentId: string;
    content: string;
    createdAt: string;
    isQuestion: boolean;
    user: {
      clerkUserId: string;
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
    };
    replies?: CourseCommentProps['comment'][];
  };
  courseId: string;
  articleId: string;
  onReplyAdded?: () => void;
}

export function CourseComment({ comment, courseId, articleId, onReplyAdded }: CourseCommentProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const isAIComment = comment.user.clerkUserId === 'ai-assistant';
  const userName = isAIComment 
    ? 'AI Assistant' 
    : [comment.user.firstName, comment.user.lastName].filter(Boolean).join(' ') || 'Anonymous';

  const handleReplySubmit = () => {
    setShowReplyForm(false);
    onReplyAdded?.();
  };

  return (
    <div className="border-l-2 border-gray-200 pl-4 ml-2">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {isAIComment ? (
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot className="h-5 w-5 text-blue-600" />
            </div>
          ) : comment.user.imageUrl ? (
            <img
              src={comment.user.imageUrl}
              alt={userName}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-600" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{userName}</span>
            {isAIComment && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">AI Helper</span>
            )}
            {comment.isQuestion && !isAIComment && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Question</span>
            )}
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
          </div>
          
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</div>
          
          {!isAIComment && (
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-xs text-blue-600 hover:text-blue-800 mt-2 flex items-center gap-1"
            >
              <MessageCircle className="h-3 w-3" />
              Reply
            </button>
          )}
          
          {showReplyForm && (
            <div className="mt-3">
              <CourseCommentForm
                courseId={courseId}
                articleId={articleId}
                parentId={comment.commentId}
                onSubmit={handleReplySubmit}
                onCancel={() => setShowReplyForm(false)}
                placeholder="Write a reply..."
              />
            </div>
          )}
          
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="text-xs text-gray-600 hover:text-gray-800 mb-2"
              >
                {showReplies ? 'Hide' : 'Show'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
              </button>
              
              {showReplies && (
                <div className="space-y-3">
                  {comment.replies.map((reply) => (
                    <CourseComment
                      key={reply.commentId}
                      comment={reply}
                      courseId={courseId}
                      articleId={articleId}
                      onReplyAdded={onReplyAdded}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}