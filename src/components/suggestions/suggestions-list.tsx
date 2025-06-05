'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { formatDistanceToNow } from 'date-fns';
import { useFeatureAccess } from '@/hooks/use-feature-access';
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle, MessageSquare, Bot, User, ChevronDown, ChevronRight } from 'lucide-react';
import MarkdownViewer from '@/components/markdown-viewer';
import { SuggestionInput } from './suggestion-input';

interface Suggestion {
  id: string;
  articleId: string;
  userId: string;
  userName: string;
  type: string;
  details: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'applied';
  statusMessage: string;
  createdAt: string;
  processedAt?: string;
  appliedAt?: string;
  rejectionReason?: string;
  aiResponse?: string;
}

interface SuggestionsListProps {
  articleId: string;
  currentUserId?: string | null;
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

export function SuggestionsList({ articleId, currentUserId }: SuggestionsListProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const { isSignedIn } = useUser();
  const { access: suggestionsAccess, loading: accessLoading } = useFeatureAccess('suggest_article_improvements');
  const suggestionsRef = useRef<Suggestion[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keep ref in sync with state
  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);

  // Scroll to bottom only when section is first expanded, not on every update
  useEffect(() => {
    if (isExpanded && messagesEndRef.current && suggestions.length > 0) {
      // Only scroll the container, not the entire page
      const timeoutId = setTimeout(() => {
        if (messagesEndRef.current) {
          const container = messagesEndRef.current.closest('.overflow-y-auto');
          if (container) {
            // Scroll only the container, not the page
            container.scrollTop = container.scrollHeight;
          }
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isExpanded]); // Remove suggestions dependency to prevent scroll on polls

  useEffect(() => {
    if (isSignedIn) {
      fetchSuggestions();
      
      // Set up polling - poll every 2 seconds for faster updates
      const interval = setInterval(() => {
        fetchSuggestions();
      }, 2000); // Poll every 2 seconds for faster status updates

      return () => clearInterval(interval);
    }
  }, [articleId, isSignedIn]);

  const fetchSuggestions = async () => {
    try {
      const response = await fetch(`/api/articles/${articleId}/suggestions`);
      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }
      const data = await response.json();
      setSuggestions(data.suggestions || []);
      
      // Auto-expand if there are suggestions
      if (data.suggestions && data.suggestions.length > 0 && !isExpanded) {
        setIsExpanded(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionSubmitted = () => {
    // Refresh the suggestions list
    fetchSuggestions();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'applied':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-gray-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  if (!isSignedIn) {
    return null;
  }

  if (loading) {
    return (
      <div className="mt-8 border-t pt-8">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading suggestions...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 border-t pt-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t pt-8">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="text-lg font-semibold flex items-center group-hover:text-blue-600 transition-colors">
          <MessageSquare className="h-5 w-5 mr-2" />
          Suggestion Discussion {suggestions.length > 0 && `(${suggestions.length})`}
        </h3>
        <div className="flex items-center">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
          )}
        </div>
      </button>
      
      {isExpanded && suggestions.length > 0 && (
        <div className="mt-4 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="space-y-6">
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="space-y-3">
                {/* User Message */}
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-medium text-sm">{suggestion.userName}</span>
                        {currentUserId === suggestion.userId && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">You</span>
                        )}
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(suggestion.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <div className="mb-2">
                        <span className="inline-block text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                          {suggestionTypeLabels[suggestion.type] || suggestion.type}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-800">
                        {suggestion.details}
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Response */}
                {(suggestion.status !== 'pending' || suggestion.aiResponse) && (
                  <div className="flex items-start space-x-3 ml-11">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-purple-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className={`rounded-lg p-4 shadow-sm border ${
                        suggestion.status === 'applied' ? 'bg-green-50 border-green-200' :
                        suggestion.status === 'approved' ? 'bg-blue-50 border-blue-200' :
                        suggestion.status === 'rejected' ? 'bg-red-50 border-red-200' :
                        suggestion.status === 'processing' ? 'bg-gray-50 border-gray-200 animate-pulse' :
                        'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-medium text-sm">AI Assistant</span>
                          {getStatusIcon(suggestion.status)}
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500">
                            {suggestion.processedAt 
                              ? formatDistanceToNow(new Date(suggestion.processedAt), { addSuffix: true })
                              : 'Processing...'}
                          </span>
                        </div>
                        
                        {suggestion.status === 'processing' ? (
                          <p className="text-sm text-gray-600 italic">
                            Analyzing your suggestion...
                          </p>
                        ) : suggestion.status === 'applied' ? (
                          <div className="space-y-3">
                            {/* Show original AI approval message */}
                            {suggestion.aiResponse && (
                              <div className="text-sm text-gray-700">
                                <MarkdownViewer content={suggestion.aiResponse} />
                              </div>
                            )}
                            {/* Show applied confirmation */}
                            <div className="text-sm font-medium text-green-800 bg-green-50 px-3 py-2 rounded-md border border-green-200">
                              ✅ {suggestion.statusMessage}
                            </div>
                          </div>
                        ) : (
                          suggestion.aiResponse && (
                            <div className="text-sm text-gray-700">
                              <MarkdownViewer content={suggestion.aiResponse} />
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div ref={messagesEndRef} />
        </div>
      )}
      
      {/* Input for new suggestions - always visible when the section is expanded OR when user doesn't have access */}
      {(isExpanded || !isSignedIn || !suggestionsAccess?.hasAccess) && (
        <div className={isExpanded ? "mt-4" : "mt-4 border-t pt-4"}>
          <SuggestionInput articleId={articleId} onSuggestionSubmitted={handleSuggestionSubmitted} />
        </div>
      )}
    </div>
  );
}