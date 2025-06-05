'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft,
  FileText,
  User,
  Calendar,
  GitCompare,
  RotateCcw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ChangeDetail {
  id: string;
  articleId: string;
  changeType: string;
  description: string;
  diff: string;
  isActive: boolean;
  createdAt: string;
  rolledBackAt: string | null;
  article: {
    articleId: string;
    articleTitle: string;
    articleSlug: string;
  };
  user: {
    clerkUserId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
  suggestion: {
    suggestionId: string;
    suggestionType: string;
    suggestionDetails: string;
    isApproved: boolean;
    processedAt: string;
    aiValidationResponse: string;
  } | null;
  rollbackUser: {
    clerkUserId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export default function ChangeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [change, setChange] = useState<ChangeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChange();
  }, [params.articleId, params.changeId]);

  const loadChange = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/articles/${params.articleId}/changes/${params.changeId}`
      );
      if (!response.ok) throw new Error('Failed to load change');

      const data = await response.json();
      setChange(data);
    } catch (error) {
      console.error('Error loading change:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!change) return;
    
    if (!confirm('Are you sure you want to rollback this change? This will restore the article to its previous state.')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/articles/${change.articleId}/changes/${change.id}/rollback`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) throw new Error('Failed to rollback change');

      const result = await response.json();
      alert(result.message);
      router.push('/admin/changes');
    } catch (error) {
      console.error('Error rolling back change:', error);
      alert('Failed to rollback change');
    }
  };

  const getUserName = (user: ChangeDetail['user'] | null) => {
    if (!user) return 'Unknown';
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email;
  };

  const formatDiff = (diff: string) => {
    return diff.split('\n').map((line, index) => {
      let className = '';
      if (line.startsWith('+') && !line.startsWith('+++')) {
        className = 'bg-green-100 text-green-800';
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        className = 'bg-red-100 text-red-800';
      } else if (line.startsWith('@@')) {
        className = 'bg-blue-100 text-blue-800 font-medium';
      }

      return (
        <div key={index} className={`font-mono text-sm px-2 py-0.5 ${className}`}>
          {line || '\u00A0'}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">Loading change details...</div>
      </div>
    );
  }

  if (!change) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">Change not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/changes')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Changes
          </Button>
          <h1 className="text-2xl font-bold">Change Details</h1>
        </div>

        {change.isActive && change.changeType !== 'rollback' && (
          <Button variant="destructive" onClick={handleRollback}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Rollback This Change
          </Button>
        )}
      </div>

      {/* Change Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {change.article.articleTitle}
          </CardTitle>
          <CardDescription>{change.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Change Type
              </p>
              <Badge variant="secondary">{change.changeType}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Status
              </p>
              <Badge variant={change.isActive ? 'default' : 'secondary'}>
                {change.isActive ? 'Active' : 'Rolled Back'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Changed By
              </p>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {getUserName(change.user)}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Changed On
              </p>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatDistanceToNow(new Date(change.createdAt), {
                  addSuffix: true,
                })}
              </div>
            </div>
          </div>

          {change.rolledBackAt && change.rollbackUser && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-800">
                This change was rolled back by {getUserName(change.rollbackUser)}{' '}
                {formatDistanceToNow(new Date(change.rolledBackAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          )}

          {change.suggestion && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <h3 className="font-medium">Original Suggestion</h3>
              <p className="text-sm">
                <span className="font-medium">Type:</span> {change.suggestion.suggestionType}
              </p>
              <p className="text-sm">
                <span className="font-medium">Details:</span> {change.suggestion.suggestionDetails}
              </p>
              {change.suggestion.aiValidationResponse && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">
                    AI Validation Response
                  </summary>
                  <div className="mt-2 p-2 bg-white rounded overflow-x-auto">
                    {(() => {
                      try {
                        // Try to parse as JSON first (old format)
                        const parsed = JSON.parse(change.suggestion.aiValidationResponse);
                        return (
                          <pre>
                            {JSON.stringify(parsed, null, 2)}
                          </pre>
                        );
                      } catch {
                        // If parsing fails, it's the new user-friendly format
                        return (
                          <div className="text-gray-700 whitespace-pre-wrap">
                            {change.suggestion.aiValidationResponse}
                          </div>
                        );
                      }
                    })()}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diff View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Change Diff
          </CardTitle>
          <CardDescription>
            Shows what was added (+) and removed (-) in this change
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
            {formatDiff(change.diff)}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/articles/${change.article.articleSlug}`)
          }
        >
          View Article
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/admin/articles/${change.articleId}/edit`)
          }
        >
          Edit Article
        </Button>
      </div>
    </div>
  );
}