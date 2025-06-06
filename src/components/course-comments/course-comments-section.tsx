'use client';

import { useState, useEffect } from 'react';
import { CourseComment } from './course-comment';
import { CourseCommentForm } from './course-comment-form';
import { Button } from '@/components/ui/button';
import { MessageSquare, Loader2 } from 'lucide-react';

interface CourseCommentsSectionProps {
  courseId: string;
  articleId: string;
}

export function CourseCommentsSection({ courseId, articleId }: CourseCommentsSectionProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalComments, setTotalComments] = useState(0);

  const fetchComments = async (pageNum: number = 1) => {
    try {
      const response = await fetch(
        `/api/courses/${courseId}/articles/${articleId}/comments?page=${pageNum}&limit=20`
      );
      
      if (!response.ok) throw new Error('Failed to fetch comments');
      
      const data = await response.json();
      
      if (pageNum === 1) {
        setComments(data.comments);
      } else {
        setComments(prev => [...prev, ...data.comments]);
      }
      
      setTotalComments(data.pagination.total);
      setHasMore(pageNum < data.pagination.totalPages);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments(1);
  }, [courseId, articleId]);

  const handleCommentAdded = () => {
    fetchComments(1); // Refresh comments
  };

  const handleLoadMore = () => {
    fetchComments(page + 1);
  };

  return (
    <div className="mt-8 border-t pt-8">
      <div className="mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Discussion ({totalComments})
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Ask questions about this lesson and get help from the community
        </p>
      </div>

      <div className="mb-6">
        <CourseCommentForm
          courseId={courseId}
          articleId={articleId}
          onSubmit={handleCommentAdded}
        />
      </div>

      {loading && comments.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No comments yet. Be the first to start a discussion!</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {comments.map((comment) => (
              <CourseComment
                key={comment.commentId}
                comment={comment}
                courseId={courseId}
                articleId={articleId}
                onReplyAdded={handleCommentAdded}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Load more comments
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}