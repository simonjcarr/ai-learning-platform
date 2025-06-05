'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useFeatureAccess } from '@/hooks/use-feature-access';
import { Send, CreditCard } from 'lucide-react';
import Link from 'next/link';

interface SuggestionInputProps {
  articleId: string;
  onSuggestionSubmitted: () => void;
}

const suggestionTypeLabels: Record<string, string> = {
  CONTENT_ADDITION: 'Add missing content',
  CONTENT_CORRECTION: 'Correct an error',
  GRAMMAR_SPELLING: 'Fix grammar/spelling',
  CODE_IMPROVEMENT: 'Improve code example',
  CLARITY_IMPROVEMENT: 'Improve clarity',
  EXAMPLE_ADDITION: 'Add an example',
  LINK_UPDATE: 'Update a link',
  OTHER: 'Other improvement',
};

export function SuggestionInput({ articleId, onSuggestionSubmitted }: SuggestionInputProps) {
  const [suggestionType, setSuggestionType] = useState('');
  const [suggestionDetails, setSuggestionDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isSignedIn, user } = useUser();
  const { access: suggestionsAccess, loading: accessLoading } = useFeatureAccess('suggest_article_improvements');

  // Debug logging (remove in production)
  console.log('SuggestionInput Debug:', {
    isSignedIn,
    accessLoading,
    suggestionsAccess,
    hasAccess: suggestionsAccess?.hasAccess
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!suggestionType || !suggestionDetails.trim()) {
      alert('Please select a suggestion type and provide details.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/articles/${articleId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionType, suggestionDetails }),
      });

      const data = await response.json();

      if (response.ok && data.suggestion) {
        // Clear the form
        setSuggestionType('');
        setSuggestionDetails('');
        
        // Notify parent to refresh
        onSuggestionSubmitted();
      } else {
        alert(data.message || data.error || 'Failed to submit suggestion');
      }
    } catch (err) {
      alert('Failed to submit suggestion. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while checking access
  if (accessLoading) {
    return (
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mx-auto mb-2"></div>
          <div className="h-8 bg-gray-300 rounded w-24 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Always show the access message if user doesn't have suggestions access
  if (!isSignedIn || !suggestionsAccess?.hasAccess) {
    return (
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
        {!isSignedIn ? (
          <>
            <p className="text-gray-600 mb-3">Sign in to join the discussion and suggest improvements</p>
            <Link
              href="/sign-in"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Sign In
            </Link>
          </>
        ) : (
          <>
            <CreditCard className="mx-auto h-8 w-8 text-blue-600 mb-2" />
            <p className="text-blue-800 mb-3">Upgrade to join the discussion and suggest improvements</p>
            <Link
              href="/pricing"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              View Plans
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 border-t pt-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">
                {user?.firstName?.[0] || user?.username?.[0] || 'U'}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="mb-3">
                <select
                  value={suggestionType}
                  onChange={(e) => setSuggestionType(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">What would you like to suggest?</option>
                  {Object.entries(suggestionTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-3">
                <textarea
                  value={suggestionDetails}
                  onChange={(e) => setSuggestionDetails(e.target.value)}
                  placeholder="Describe your suggestion in detail..."
                  disabled={isSubmitting}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  required
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !suggestionType || !suggestionDetails.trim()}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Suggestion
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}