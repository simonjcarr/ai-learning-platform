'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import { useFeatureAccess } from '@/hooks/use-feature-access';
import { CreditCard } from 'lucide-react';
import Link from 'next/link';

interface ArticleSuggestionFormProps {
  articleId: string;
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

export function ArticleSuggestionForm({ articleId }: ArticleSuggestionFormProps) {
  const { user } = useAuth();
  const { isSubscribed, isLoadingSubscription } = useSubscription();
  const { access: suggestionsAccess } = useFeatureAccess('suggest_article_improvements');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [suggestionType, setSuggestionType] = useState('');
  const [suggestionDetails, setSuggestionDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasFreshResponse, setHasFreshResponse] = useState(false); // True when API responds, false after user acknowledges
  const [jobId, setJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const isSubmittingRef = useRef(isSubmitting);
  const hasFreshResponseRef = useRef(hasFreshResponse);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    hasFreshResponseRef.current = hasFreshResponse;
  }, [hasFreshResponse]);

  const fullReset = () => {
    setSuggestionType('');
    setSuggestionDetails('');
    setResult(null);
    setHasFreshResponse(false);
    setIsSubmitting(false); // Ensure submitting state is also reset
    setJobId(null);
    setIsPolling(false);
  };

  const handleDialogTriggerClick = () => {
    console.log("DialogTrigger onClick: Opening dialog. Resetting form and clearing previous results.");
    fullReset();
    setDialogOpen(true);
  };

  const handleOKButtonClick = () => {
    console.log("'OK' button clicked. Closing modal, resetting form and fresh response state.");
    setHasFreshResponse(false); // Acknowledge the response
    // Keep result until dialog is fully closed and reset by handleOpenChange or reopened
    setDialogOpen(false); // Close the dialog
    // fullReset() will be called by handleOpenChange when dialogOpen becomes false
  };

  const handleOpenChange = (open: boolean) => {
    console.log(`handleOpenChange: open=${open}, hasFreshResponse=${hasFreshResponseRef.current}`);
    if (!open) { // If attempting to close
      console.log("handleOpenChange: Dialog closing. Performing full reset.");
      fullReset(); // Always reset fully when dialog closes, regardless of how
    }
    setDialogOpen(open); // Update the actual dialog state
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
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    console.log("handleSubmit: Started, isSubmittingRef.current:", isSubmittingRef.current);

    if (!suggestionType || !suggestionDetails.trim()) {
      console.log("handleSubmit: Validation failed - empty fields");
      setResult({ success: false, message: 'Please select a suggestion type and provide details.' });
      setHasFreshResponse(true);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      return;
    }
    setResult(null);

    try {
      console.log("handleSubmit: Attempting fetch for articleId:", articleId);
      
      const response = await fetch(`/api/articles/${articleId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionType, suggestionDetails }),
      });
      
      console.log("handleSubmit: Fetch response received", response.status);

      const data = await response.json();
      console.log("handleSubmit: JSON data parsed", data);

      if (response.ok && data.suggestion) {
        // AI has immediately evaluated the suggestion
        setResult({
          success: data.suggestion.isApproved,
          message: data.suggestion.isApproved 
            ? `Great! Your suggestion has been approved and will be applied. ${data.message || ''}`
            : `${data.message || 'Thanks for your feedback!'} The AI has responded below.`,
        });
        setHasFreshResponse(true);
        setIsSubmitting(false);
        isSubmittingRef.current = false;
        
        // Refresh the suggestions list to show the new conversation
        window.location.reload();
      } else {
        // Handle non-ok responses
        setResult({ success: false, message: data.message || data.error || `Request failed with status ${response.status}.` });
        setHasFreshResponse(true);
        setIsSubmitting(false);
        isSubmittingRef.current = false;
      }

    } catch (err) {
      console.error("handleSubmit: Error during fetch or processing", err);
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to submit suggestion',
      });
      setHasFreshResponse(true);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  if (!user) return null;
  
  // Check if user has access to suggestions feature
  if (!suggestionsAccess?.hasAccess) {
    return null;
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={handleDialogTriggerClick}>
          Suggest Improvement
        </Button>
      </DialogTrigger>
      <DialogContent 
        onPointerDownOutside={(e) => {
          if (isSubmittingRef.current || hasFreshResponseRef.current) {
            console.log("DialogContent: Preventing close onPointerDownOutside due to submission or fresh response.");
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isSubmittingRef.current || hasFreshResponseRef.current) {
            console.log("DialogContent: Preventing close onEscapeKeyDown due to submission or fresh response.");
            e.preventDefault();
          }
        }}
        className="sm:max-w-[525px] bg-white"
      >
        <DialogHeader>
          <DialogTitle>Suggest an Improvement</DialogTitle>
          <DialogDescription>
            Your feedback helps us improve our content. Please be specific.
            {/* Lint fix: Replaced ' with &apos; */}
            Provide details about the improvement you&apos;re suggesting or the issue you&apos;ve found.
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="py-4 text-center">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Please Sign In
              </h3>
              <p className="text-gray-600 mb-4">
                You need to be signed in to suggest improvements to articles.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Link href="/sign-in">
                <Button className="bg-orange-600 text-white hover:bg-orange-700">
                  Sign In
                </Button>
              </Link>
            </DialogFooter>
          </div>
        ) : !isSubscribed && !isLoadingSubscription ? (
          <div className="py-4 text-center">
            <CreditCard className="mx-auto h-12 w-12 text-blue-600 mb-4" />
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Subscription Required
              </h3>
              <p className="text-gray-600 mb-4">
                Article suggestions are available to subscribed users. Upgrade your plan to suggest improvements and help us make our content better.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Link href="/pricing">
                <Button className="bg-blue-600 text-white hover:bg-blue-700">
                  View Plans
                </Button>
              </Link>
            </DialogFooter>
          </div>
        ) : hasFreshResponse && result ? (
          <div className="py-4">
            <div className={`mt-4 p-3 rounded-md text-sm ${result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {result.message}
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" onClick={handleOKButtonClick}>OK</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="suggestion-type" className="text-right col-span-1">
                  Type
                </Label>
                <Select value={suggestionType} onValueChange={setSuggestionType} disabled={isSubmitting}>
                  <SelectTrigger id="suggestion-type" className="col-span-3">
                    <SelectValue placeholder="Select improvement type" />
                  </SelectTrigger>
                  <SelectContent>
                    {suggestionTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="col-span-3">
                  <Label htmlFor="suggestion-details" className="text-gray-700">Details</Label>
                  <Textarea
                    id="suggestion-details"
                    placeholder="Please provide specific details about your suggestion..."
                    value={suggestionDetails}
                    onChange={(e) => setSuggestionDetails(e.target.value)}
                    className="min-h-[120px] border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)} // Directly trigger close, handleOpenChange will do the reset
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-orange-600 text-white hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 disabled:bg-gray-400"
              >
                {isSubmitting ? (isPolling ? 'Processing...' : 'Submitting...') : 'Submit Suggestion'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}