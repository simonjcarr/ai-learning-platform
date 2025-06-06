'use client';

import { useState, useEffect } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CourseLikeButtonProps {
  courseId: string;
  initialLiked?: boolean;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  showText?: boolean;
}

export function CourseLikeButton({
  courseId,
  initialLiked = false,
  size = 'default',
  variant = 'ghost',
  showText = true
}: CourseLikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check initial like status
    const checkLikeStatus = async () => {
      try {
        const response = await fetch(`/api/courses/${courseId}/like`);
        if (response.ok) {
          const data = await response.json();
          setLiked(data.liked);
        }
      } catch (err) {
        console.error('Error checking like status:', err);
      }
    };

    checkLikeStatus();
  }, [courseId]);

  const toggleLike = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/courses/${courseId}/like`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to toggle like');
      }

      const data = await response.json();
      setLiked(data.liked);
    } catch (err) {
      setError('Failed to update like. Please try again.');
      console.error('Error toggling like:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant={variant}
        size={size}
        onClick={toggleLike}
        disabled={loading}
        className={cn(
          "flex items-center gap-2 transition-colors",
          liked && "text-red-500 hover:text-red-600",
          !liked && "text-gray-500 hover:text-gray-700"
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart
            className={cn(
              "h-4 w-4 transition-all",
              liked && "fill-current"
            )}
          />
        )}
        {showText && (
          <span className="text-sm">
            {liked ? 'Liked' : 'Like'}
          </span>
        )}
      </Button>
      
      {error && (
        <p className="text-xs text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}