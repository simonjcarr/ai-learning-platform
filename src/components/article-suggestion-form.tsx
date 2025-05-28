'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';

interface ArticleSuggestionFormProps {
  articleId: string;
  onSuggestionSubmitted?: () => void;
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

export function ArticleSuggestionForm({ articleId, onSuggestionSubmitted }: ArticleSuggestionFormProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [suggestionType, setSuggestionType] = useState('');
  const [suggestionDetails, setSuggestionDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!suggestionType || !suggestionDetails.trim()) {
      setResult({ success: false, message: 'Please fill in all fields' });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch(`/api/articles/${articleId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionType, suggestionDetails }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit suggestion');
      }

      if (data.suggestion.isApproved) {
        setResult({
          success: true,
          message: `Great! Your suggestion has been approved and applied. You now have ${data.approvedSuggestionsCount} approved suggestions!`,
        });
        
        if (onSuggestionSubmitted) {
          onSuggestionSubmitted();
        }
        
        // Reset form
        setTimeout(() => {
          setIsOpen(false);
          setSuggestionType('');
          setSuggestionDetails('');
          setResult(null);
        }, 3000);
      } else {
        setResult({
          success: false,
          message: `Your suggestion was not approved: ${data.suggestion.reason}`,
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to submit suggestion',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700">
          Suggest Improvement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">Suggest an Improvement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="suggestion-type" className="text-gray-700">Type of Improvement</Label>
            <Select value={suggestionType} onValueChange={setSuggestionType}>
              <SelectTrigger id="suggestion-type" className="w-full border-gray-300 focus:border-orange-500 focus:ring-orange-500">
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
          </div>
          
          <div>
            <Label htmlFor="suggestion-details" className="text-gray-700">Details</Label>
            <Textarea
              id="suggestion-details"
              placeholder="Please provide specific details about your suggestion..."
              value={suggestionDetails}
              onChange={(e) => setSuggestionDetails(e.target.value)}
              className="min-h-[120px] border-gray-300 focus:border-orange-500 focus:ring-orange-500"
            />
          </div>

          {result && (
            <div
              className={`p-3 rounded-md text-sm ${
                result.success
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {result.message}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-orange-600 text-white hover:bg-orange-700 focus:ring-2 focus:ring-orange-500"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}