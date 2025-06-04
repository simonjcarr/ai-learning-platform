"use client";

import { useState } from "react";
import { MoreVertical, MessageCircle, X } from "lucide-react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import { CourseChatInterface } from "./course-chat-interface";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { Button } from "./ui/button";
import Link from "next/link";

interface CourseFloatingActionMenuProps {
  courseArticleId?: string;
  courseId: string;
  currentQuizId?: string;
}

export function CourseFloatingActionMenu({ 
  courseArticleId, 
  courseId,
  currentQuizId 
}: CourseFloatingActionMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  const { access: chatAccess, loading: chatLoading } = useFeatureAccess("course_ai_chat");

  const { refs, floatingStyles, context } = useFloating({
    open: isMenuOpen,
    onOpenChange: setIsMenuOpen,
    middleware: [offset(10), flip(), shift()],
    whileElementsMounted: autoUpdate,
    placement: "top-end",
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  const handleChatClick = () => {
    setIsMenuOpen(false);
    setShowChat(true); // Always show the chat panel - it will handle access control internally
  };

  // Chat context data
  const chatContext = {
    type: "course_article" as const,
    courseId,
    articleId: courseArticleId,
    quizId: currentQuizId,
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        className="fixed bottom-4 right-4 z-40 bg-orange-600 text-white rounded-full p-3 shadow-lg hover:bg-orange-700 transition-colors"
        aria-label="Open course actions menu"
      >
        <MoreVertical className="h-6 w-6" />
      </button>

      {/* Menu */}
      {isMenuOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[200px]"
          >
            <button
              onClick={handleChatClick}
              disabled={chatLoading}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2 text-sm"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Course AI Tutor</span>
            </button>
          </div>
        </FloatingPortal>
      )}

      {/* Chat Panel - Bottom Right Modal */}
      {showChat && (
        <div className="fixed bottom-0 right-0 w-full sm:w-96 h-[600px] bg-white shadow-2xl rounded-t-lg sm:rounded-tl-lg border border-gray-200 z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold">Course AI Tutor</h3>
            </div>
            <button
              onClick={() => setShowChat(false)}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Chat Content */}
          <div className="flex-1 overflow-hidden">
            {courseArticleId ? (
              <CourseChatInterface 
                courseId={courseId}
                articleId={courseArticleId} 
                currentExampleId={currentQuizId}
              />
            ) : (
              <div className="p-4 text-center text-gray-500">
                <p>Course AI Tutor is available when viewing course content.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}