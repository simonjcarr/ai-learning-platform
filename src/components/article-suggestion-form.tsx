'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [suggestionType, setSuggestionType] = useState('');
  const [suggestionDetails, setSuggestionDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasFreshResponse, setHasFreshResponse] = useState(false); // True when API responds, false after user acknowledges

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
      
      // Create an AbortController with a 90-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds
      
      const response = await fetch(`/api/articles/${articleId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionType, suggestionDetails }),
        redirect: 'manual',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log("handleSubmit: Fetch response received", response.status);

      const data = await response.json();
      console.log("handleSubmit: JSON data parsed", data);

      if (response.ok) {
        if (data.suggestion && typeof data.suggestion.isApproved === 'boolean') {
          setResult({
            success: data.suggestion.isApproved,
            message: data.suggestion.isApproved 
              ? `Great! Your suggestion has been approved and applied. You now have ${data.approvedSuggestionsCount} approved suggestions! Please refresh your browser to see the changes.`
              : data.message || data.suggestion.rejectionReason || 'Your suggestion was not approved at this time. It has been saved for review.',
          });
        } else {
          // Handle cases where response is ok but data structure is unexpected
          setResult({ success: false, message: data.message || 'Received an unexpected response from the server.' });
        }
      } else {
        // Handle non-ok responses (e.g., 400, 403, 500)
        setResult({ success: false, message: data.message || data.error || `Request failed with status ${response.status}.` });
      }
      setHasFreshResponse(true); // Signal that a fresh response is available

    } catch (err) {
      console.error("handleSubmit: Error during fetch or processing", err);
      
      if (err instanceof Error && err.name === 'AbortError') {
        setResult({
          success: false,
          message: 'The request took too long to process. Your suggestion has been submitted and will be reviewed. Please refresh the page to see if changes were applied.',
        });
      } else if (err instanceof Error && err.message.includes('JSON')) {
        // Handle JSON parsing errors (likely due to timeout/redirect)
        setResult({
          success: false,
          message: 'The server response was interrupted. Your suggestion may have been processed. Please refresh the page to check for updates.',
        });
      } else {
        setResult({
          success: false,
          message: err instanceof Error ? err.message : 'Failed to submit suggestion',
        });
      }
      setHasFreshResponse(true);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      console.log("handleSubmit: Finished, isSubmittingRef.current:", isSubmittingRef.current);
    }
  };

  if (!user) return null;

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

        {hasFreshResponse && result ? (
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
                {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}