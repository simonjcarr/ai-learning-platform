'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Sparkles, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import MarkdownViewer from '@/components/markdown-viewer';

interface CourseArticle {
  articleId: string;
  title: string;
  contentHtml?: string;
  section: {
    title: string;
    course: {
      courseId: string;
      title: string;
    };
  };
}

interface PageProps {
  params: Promise<{ courseId: string; articleId: string }>;
}

const suggestionTypes = [
  { value: 'CONTENT_ADDITION', label: 'Add missing content' },
  { value: 'CONTENT_CORRECTION', label: 'Correct an error' },
  { value: 'GRAMMAR_SPELLING', label: 'Fix grammar/spelling' },
  { value: 'CODE_IMPROVEMENT', label: 'Improve code example' },
  { value: 'CLARITY_IMPROVEMENT', label: 'Improve clarity' },
  { value: 'EXAMPLE_ADDITION', label: 'Add an example' },
  { value: 'LINK_UPDATE', label: 'Update a link' },
  { value: 'EXTERNAL_RESOURCE', label: 'Add external resource (link/video)' },
  { value: 'OTHER', label: 'Other improvement' },
];

export default function SuggestCourseArticlePage({ params }: PageProps) {
  const router = useRouter();
  const [courseArticle, setCourseArticle] = useState<CourseArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form fields
  const [suggestionType, setSuggestionType] = useState('');
  const [suggestionDetails, setSuggestionDetails] = useState('');
  
  // Result state
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    diff?: string;
    changeId?: string;
  } | null>(null);

  useEffect(() => {
    fetchCourseArticle();
  }, []);

  const fetchCourseArticle = async () => {
    try {
      setLoading(true);
      const { courseId, articleId } = await params;
      
      const response = await fetch(`/api/admin/courses/${courseId}/articles/${articleId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch course article');
      }
      
      const data = await response.json();
      setCourseArticle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!courseArticle || !suggestionType || !suggestionDetails.trim()) {
      setError('Please select a suggestion type and provide details');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      setResult(null);
      
      const { courseId, articleId } = await params;
      
      const response = await fetch(`/api/admin/courses/${courseId}/articles/${articleId}/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestionType,
          suggestionDetails,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process suggestion');
      }
      
      setResult({
        success: data.success,
        message: data.message,
        diff: data.diff,
        changeId: data.changeId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit suggestion');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error && !courseArticle) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.back()}
          >
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  if (!courseArticle) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Suggestion for Course Article</h1>
            <p className="text-sm text-gray-600 mt-1">
              {courseArticle.section.course.title} / {courseArticle.section.title}
            </p>
          </div>
          <Link href={`/admin/courses/${courseArticle.section.course.courseId}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
          </Link>
        </div>
      </div>

      {/* Article Info */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">{courseArticle.title}</h2>
        {courseArticle.contentHtml ? (
          <div className="text-sm text-gray-600">
            Article has {courseArticle.contentHtml.length} characters of content
          </div>
        ) : (
          <div className="text-sm text-yellow-600">
            No content generated yet
          </div>
        )}
      </Card>

      {/* Result */}
      {result && (
        <Card className={`p-6 mb-6 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start space-x-3">
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={result.success ? 'text-green-800' : 'text-red-800'}>
                {result.message}
              </p>
              {result.changeId && (
                <div className="mt-4">
                  <Link href={`/admin/courses/${courseArticle.section.course.courseId}/articles/${courseArticle.articleId}/changes/${result.changeId}`}>
                    <Button variant="outline" size="sm">
                      View Changes
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Suggestion Form */}
      {!result?.success && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="suggestion-type">Suggestion Type</Label>
              <Select value={suggestionType} onValueChange={setSuggestionType} disabled={submitting}>
                <SelectTrigger id="suggestion-type" className="mt-1">
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
              <Label htmlFor="suggestion-details">Details</Label>
              <Textarea
                id="suggestion-details"
                value={suggestionDetails}
                onChange={(e) => setSuggestionDetails(e.target.value)}
                className="mt-1"
                rows={6}
                placeholder="Provide specific details about your suggestion..."
                disabled={submitting}
              />
              <p className="text-sm text-gray-600 mt-2">
                <strong>Note:</strong> External links and YouTube videos are allowed in course articles. 
                Feel free to include relevant educational resources.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Button
                onClick={handleSubmit}
                disabled={submitting || !suggestionType || !suggestionDetails.trim()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Submit Suggestion
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => router.push(`/admin/courses/${courseArticle.section.course.courseId}`)}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">{error}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Diff Preview */}
      {result?.diff && (
        <Card className="p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">Changes Applied</h3>
          <div className="bg-gray-50 p-4 rounded font-mono text-sm overflow-x-auto">
            <pre>{result.diff}</pre>
          </div>
        </Card>
      )}
    </div>
  );
}