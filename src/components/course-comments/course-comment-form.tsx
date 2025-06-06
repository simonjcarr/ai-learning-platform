'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface CourseCommentFormProps {
  courseId: string;
  articleId: string;
  parentId?: string;
  onSubmit?: () => void;
  onCancel?: () => void;
  placeholder?: string;
}

export function CourseCommentForm({
  courseId,
  articleId,
  parentId,
  onSubmit,
  onCancel,
  placeholder = "Write a comment or ask a question about this lesson..."
}: CourseCommentFormProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Please write a comment');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/courses/${courseId}/articles/${articleId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          parentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      setContent('');
      onSubmit?.();
    } catch (err) {
      setError('Failed to post comment. Please try again.');
      console.error('Error posting comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="min-h-[100px] resize-none"
        disabled={isSubmitting}
      />
      
      {!parentId && (
        <p className="text-xs text-gray-500">
          💡 AI will automatically respond to learning questions about course concepts, tools, and practical implementations mentioned in the lesson.
        </p>
      )}
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          size="sm"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {parentId ? 'Reply' : 'Comment'}
        </Button>
        
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}