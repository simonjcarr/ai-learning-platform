"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useRedirectUrl } from "@/hooks/use-redirect-url";

interface LikeButtonProps {
  articleId: string;
  className?: string;
  iconOnly?: boolean;
}

export default function LikeButton({ articleId, className = "", iconOnly = false }: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { isSignedIn } = useUser();
  const router = useRouter();
  const { signInWithRedirect } = useRedirectUrl();

  useEffect(() => {
    if (isSignedIn) {
      checkLikeStatus();
    }
  }, [isSignedIn, articleId]);

  const checkLikeStatus = async () => {
    try {
      const response = await fetch(`/api/articles/${articleId}/like`);
      if (response.ok) {
        const data = await response.json();
        setIsLiked(data.isLiked);
      }
    } catch (error) {
      console.error("Error checking like status:", error);
    }
  };

  const handleLike = async () => {
    if (!isSignedIn) {
      router.push(signInWithRedirect);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/articles/${articleId}/like`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setIsLiked(data.isLiked);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      disabled={isLoading}
      className={`inline-flex items-center ${iconOnly ? "justify-center p-2" : "gap-2 px-3 py-2"} text-sm font-medium rounded-md transition-colors ${
        isLiked
          ? "bg-red-100 text-red-700 hover:bg-red-200"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title={isLiked ? "Unlike article" : "Like article"}
    >
      <Heart
        className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`}
      />
      {!iconOnly && <span>{isLiked ? "Liked" : "Like"}</span>}
    </button>
  );
}