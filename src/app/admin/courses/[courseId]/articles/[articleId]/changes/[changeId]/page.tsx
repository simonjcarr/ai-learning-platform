'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, RotateCcw, Loader2, AlertCircle, CheckCircle, User, Calendar, FileText } from 'lucide-react';
import Link from 'next/link';
import MarkdownViewer from '@/components/markdown-viewer';

interface CourseArticleChange {
  id: string;
  articleId: string;
  clerkUserId: string;
  diff: string;
  beforeContent: string;
  afterContent: string;
  changeType: string;
  description: string;
  suggestionType?: string;
  suggestionDetails?: string;
  isActive: boolean;
  rolledBackAt?: string;
  rolledBackBy?: string;
  createdAt: string;
  updatedAt: string;
  article: {
    title: string;
    section: {
      title: string;
      course: {
        courseId: string;
        title: string;
      };
    };
  };
  user: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  rollbackUser?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

interface PageProps {
  params: Promise<{ courseId: string; articleId: string; changeId: string }>;
}

export default function CourseArticleChangePage({ params }: PageProps) {
  const router = useRouter();
  const [change, setChange] = useState<CourseArticleChange | null>(null);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContent, setShowContent] = useState<'diff' | 'before' | 'after'>('diff');

  useEffect(() => {
    fetchChange();
  }, []);

  const fetchChange = async () => {
    try {
      setLoading(true);
      const { courseId, articleId, changeId } = await params;
      
      const response = await fetch(`/api/admin/courses/${courseId}/articles/${articleId}/changes/${changeId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch change history');
      }
      
      const data = await response.json();
      setChange(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async () => {
    if (!change || reverting) return;
    
    if (!confirm('Are you sure you want to revert this change? This will restore the article to its previous state.')) {
      return;
    }
    
    try {
      setReverting(true);
      setError(null);
      
      const { courseId, articleId, changeId } = await params;
      
      const response = await fetch(`/api/admin/courses/${courseId}/articles/${articleId}/changes/${changeId}/rollback`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to revert change');
      }
      
      // Redirect back to course page
      router.push(`/admin/courses/${courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert change');
    } finally {
      setReverting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error && !change) {
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

  if (!change) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Course Article Change History</h1>
            <p className="text-sm text-gray-600 mt-1">
              {change.article.section.course.title} / {change.article.section.title} / {change.article.title}
            </p>
          </div>
          <Link href={`/admin/courses/${change.article.section.course.courseId}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
          </Link>
        </div>
      </div>

      {/* Change Details */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Change Details</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
              <User className="h-4 w-4" />
              <span>Changed by:</span>
            </div>
            <p className="font-medium">
              {change.user.firstName} {change.user.lastName} ({change.user.email})
            </p>
          </div>
          
          <div>
            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
              <Calendar className="h-4 w-4" />
              <span>Changed on:</span>
            </div>
            <p className="font-medium">
              {new Date(change.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
            <FileText className="h-4 w-4" />
            <span>Description:</span>
          </div>
          <p className="text-gray-800">{change.description}</p>
          
          {change.suggestionType && (
            <div className="mt-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Type:</span> {change.suggestionType}
              </p>
              {change.suggestionDetails && (
                <p className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">Details:</span> {change.suggestionDetails}
                </p>
              )}
            </div>
          )}
        </div>

        {change.rolledBackAt && change.rollbackUser && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              This change was reverted on {new Date(change.rolledBackAt).toLocaleString()} by{' '}
              {change.rollbackUser.firstName} {change.rollbackUser.lastName} ({change.rollbackUser.email})
            </p>
          </div>
        )}

        {!change.isActive && !change.rolledBackAt && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
            <p className="text-sm text-gray-600">
              This change is no longer active.
            </p>
          </div>
        )}
      </Card>

      {/* Actions */}
      {change.isActive && (
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Actions</h3>
          <Button
            onClick={handleRevert}
            disabled={reverting}
            variant="destructive"
          >
            {reverting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reverting...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Revert This Change
              </>
            )}
          </Button>
          <p className="text-sm text-gray-600 mt-2">
            This will restore the article to its state before this change was made.
          </p>
        </Card>
      )}

      {/* Content View */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Content Changes</h3>
          <div className="inline-flex rounded-lg border border-gray-200 p-1">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                showContent === 'diff'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setShowContent('diff')}
            >
              Diff
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                showContent === 'before'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setShowContent('before')}
            >
              Before
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                showContent === 'after'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setShowContent('after')}
            >
              After
            </button>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-gray-50 overflow-x-auto">
          {showContent === 'diff' ? (
            <pre className="font-mono text-sm whitespace-pre-wrap">{change.diff}</pre>
          ) : showContent === 'before' ? (
            <div className="prose prose-lg max-w-none">
              <MarkdownViewer content={change.beforeContent} />
            </div>
          ) : (
            <div className="prose prose-lg max-w-none">
              <MarkdownViewer content={change.afterContent} />
            </div>
          )}
        </div>
      </Card>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
}