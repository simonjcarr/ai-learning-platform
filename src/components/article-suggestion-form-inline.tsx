'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import { useFeatureAccess } from '@/hooks/use-feature-access';
import { CreditCard, Sparkles, X } from 'lucide-react';
import Link from 'next/link';

interface ArticleSuggestionFormInlineProps {
  articleId: string;
  onClose: () => void;
}

const suggestionTypes = [
  { value: 'CONTENT_ADDITION', label: 'Add missing content' },
  { value: 'CONTENT_CORRECTION', label: 'Correct an error' },
  { value: 'GRAMMAR_SPELLING', label: 'Fix grammar/spelling' },
  { value: 'CODE_IMPROVEMENT', label: 'Improve code example' },
  { value: 'CLARITY_IMPROVEMENT', label: 'Improve clarity' },
  { value: 'EXAMPLE_ADDITION', label: 'Add an example' },
  { value: 'LINK_UPDATE', label: 'Update a link' },
  { value: 'OTHER', label: 'Other improvement' },
];

export function ArticleSuggestionFormInline({ articleId, onClose }: ArticleSuggestionFormInlineProps) {
  const { user } = useAuth();
  const { isSubscribed, isLoadingSubscription } = useSubscription();
  const { access: suggestionsAccess } = useFeatureAccess('suggest_article_improvements');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [suggestionType, setSuggestionType] = useState('');
  const [suggestionDetails, setSuggestionDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasFreshResponse, setHasFreshResponse] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    console.log('dialogOpen state changed to:', dialogOpen);
  }, [dialogOpen]);

  const fullReset = () => {
    setSuggestionType('');
    setSuggestionDetails('');
    setResult(null);
    setHasFreshResponse(false);
    setIsSubmitting(false);
    setJobId(null);
    setIsPolling(false);
  };

  const handleDialogTriggerClick = () => {
    console.log('Suggest Improvement clicked, user:', user, 'isSubscribed:', isSubscribed, 'dialogOpen before:', dialogOpen);
    fullReset();
    setDialogOpen(true);
    console.log('Set dialogOpen to true');
    // Don't call onClose() - let the modal manage its own lifecycle
  };

  const handleClose = () => {
    setDialogOpen(false);
    fullReset();
  };

  const checkJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/articles/${articleId}/suggest/status?jobId=${jobId}`);
      const data = await response.json();
      
      if (data.status === 'completed') {
        const result = data.result;
        if (result.suggestion && typeof result.suggestion.isApproved === 'boolean') {
          setResult({
            success: result.suggestion.isApproved,
            message: result.suggestion.isApproved 
              ? `Great! Your suggestion has been approved and applied. You now have ${result.approvedSuggestionsCount} approved suggestions! Please refresh your browser to see the changes.`
              : result.message || result.suggestion.rejectionReason || 'Your suggestion was not approved at this time. It has been saved for review.',
          });
        } else {
          setResult({ success: false, message: 'Received an unexpected response from the server.' });
        }
        setHasFreshResponse(true);
        return true; // Job is complete
      } else if (data.status === 'failed') {
        setResult({ success: false, message: data.error || 'Failed to process suggestion' });
        setHasFreshResponse(true);
        return true; // Job is complete (with failure)
      }
      
      return false; // Job is still processing
    } catch (error) {
      console.error('Failed to check job status:', error);
      return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    if (!suggestionType || !suggestionDetails.trim()) {
      setResult({ success: false, message: 'Please select a suggestion type and provide details.' });
      setHasFreshResponse(true);
      setIsSubmitting(false);
      return;
    }
    setResult(null);

    try {
      const response = await fetch(`/api/articles/${articleId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionType, suggestionDetails }),
      });

      const data = await response.json();

      if (response.ok && data.suggestion) {
        // AI has immediately evaluated the suggestion
        setResult({
          success: data.suggestion.isApproved,
          message: data.suggestion.isApproved 
            ? `Great! Your suggestion has been approved and will be applied. ${data.message || ''}`
            : `${data.message || 'Thanks for your feedback!'} The AI has responded in the discussion below.`,
        });
        setHasFreshResponse(true);
        setIsSubmitting(false);
        
        // Refresh the page to show the new conversation
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        // Handle non-ok responses
        setResult({ success: false, message: data.message || data.error || `Request failed with status ${response.status}.` });
        setHasFreshResponse(true);
        setIsSubmitting(false);
      }

    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to submit suggestion',
      });
      setHasFreshResponse(true);
      setIsSubmitting(false);
    }
  };

  console.log('ArticleSuggestionFormInline render, user:', user);
  
  if (!user) {
    return (
      <button
        onClick={() => {
          onClose();
          window.location.href = '/sign-in';
        }}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Suggest Improvement
      </button>
    );
  }
  
  // Check if user has access to suggestions feature
  if (!suggestionsAccess?.hasAccess) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleDialogTriggerClick}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Suggest Improvement
      </button>
      
      {dialogOpen && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ 
            backgroundColor: 'rgba(255, 0, 0, 0.8)', 
            zIndex: 999999,
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh'
          }}
          onClick={(e) => {
            console.log('Modal backdrop clicked');
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
        >
          {console.log('RENDERING MODAL VIA PORTAL - dialogOpen is true')}
          <div 
            className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              zIndex: 1000000,
              border: '5px solid red',
              boxShadow: '0 0 50px rgba(255, 0, 0, 0.5)'
            }}
          >
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Suggest an Improvement</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Your feedback helps us improve our content. Please be specific.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!user ? (
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Please Sign In
                  </h3>
                  <p className="text-gray-600 mb-4">
                    You need to be signed in to suggest improvements to articles.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleClose}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <Link href="/sign-in" className="flex-1">
                      <button className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700">
                        Sign In
                      </button>
                    </Link>
                  </div>
                </div>
              ) : !isSubscribed && !isLoadingSubscription ? (
                <div className="text-center">
                  <CreditCard className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Subscription Required
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Article suggestions are available to subscribed users. Upgrade your plan to suggest improvements.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleClose}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <Link href="/pricing" className="flex-1">
                      <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                        View Plans
                      </button>
                    </Link>
                  </div>
                </div>
              ) : hasFreshResponse && result ? (
                <div>
                  <div className={`p-3 rounded-md text-sm mb-4 ${result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {result.message}
                  </div>
                  <button
                    onClick={handleClose}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="suggestion-type" className="block text-sm font-medium text-gray-700 mb-2">
                      Type
                    </label>
                    <select
                      id="suggestion-type"
                      value={suggestionType}
                      onChange={(e) => setSuggestionType(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select improvement type</option>
                      {suggestionTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="suggestion-details" className="block text-sm font-medium text-gray-700 mb-2">
                      Details
                    </label>
                    <textarea
                      id="suggestion-details"
                      placeholder="Please provide specific details about your suggestion..."
                      value={suggestionDetails}
                      onChange={(e) => setSuggestionDetails(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400"
                    >
                      {isSubmitting ? (isPolling ? 'Processing...' : 'Submitting...') : 'Submit Suggestion'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}