"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

interface FlagButtonProps {
  type: "article" | "comment";
  id: string;
  isFlagged?: boolean;
  onFlagChange?: () => void;
}

export function FlagButton({ type, id, isFlagged = false, onFlagChange }: FlagButtonProps) {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [flagReason, setFlagReason] = useState("");

  async function handleFlag() {
    if (!isSignedIn) {
      alert("Please sign in to flag content");
      return;
    }

    if (isFlagged) {
      alert("This content has already been flagged");
      return;
    }

    setShowReasonModal(true);
  }

  async function submitFlag() {
    try {
      setLoading(true);
      const endpoint = type === "article" 
        ? `/api/articles/${id}/flag`
        : `/api/comments/${id}/flag`;
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagReason }),
      });

      if (!response.ok) throw new Error("Failed to flag content");
      
      setShowReasonModal(false);
      setFlagReason("");
      if (onFlagChange) onFlagChange();
    } catch (error) {
      console.error("Error flagging content:", error);
      alert("Failed to flag content");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleFlag}
        disabled={loading || isFlagged}
        className={cn(
          "flex items-center gap-1 text-sm transition-colors",
          isFlagged
            ? "text-red-600 cursor-not-allowed"
            : "text-gray-500 hover:text-red-600"
        )}
        title={isFlagged ? "Already flagged" : "Flag as inappropriate"}
      >
        <Flag className="h-4 w-4" fill={isFlagged ? "currentColor" : "none"} />
        <span>Flag</span>
      </button>

      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Flag Content</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for flagging this content:
            </p>
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Explain why this content is inappropriate..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 mb-4"
              rows={4}
              required
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowReasonModal(false);
                  setFlagReason("");
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={submitFlag}
                disabled={loading || !flagReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Submit Flag"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}