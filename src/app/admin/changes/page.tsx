'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  History, 
  Undo2, 
  User, 
  Calendar, 
  FileText,
  CheckCircle,
  XCircle,
  RotateCcw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ChangeHistory {
  id: string;
  articleId: string;
  changeType: string;
  description: string;
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
  } | null;
  rollbackUser: {
    clerkUserId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export default function AdminChangesPage() {
  const router = useRouter();
  const [changes, setChanges] = useState<ChangeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  });

  useEffect(() => {
    loadChanges();
  }, [includeInactive]);

  const loadChanges = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        includeInactive: includeInactive.toString(),
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });

      const response = await fetch(`/api/admin/changes?${params}`);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorData,
        });
        throw new Error(`Failed to load changes: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setChanges(data.changes);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error loading changes:', error);
      // Show the error in the UI
      alert(`Error loading changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (change: ChangeHistory) => {
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
      loadChanges(); // Reload the list
    } catch (error) {
      console.error('Error rolling back change:', error);
      alert('Failed to rollback change');
    }
  };

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'suggestion':
        return 'bg-blue-500';
      case 'rollback':
        return 'bg-orange-500';
      case 'admin_edit':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getUserName = (user: ChangeHistory['user'] | null) => {
    if (!user) return 'Unknown';
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            Article Change History
          </h1>
          <p className="text-muted-foreground mt-2">
            View and manage all article changes across the platform
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive"
              checked={includeInactive}
              onCheckedChange={setIncludeInactive}
            />
            <Label htmlFor="include-inactive">Show rolled back changes</Label>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.suggestion || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Rollbacks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rollback || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Admin Edits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.admin_edit || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Changes List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Changes</CardTitle>
          <CardDescription>
            All changes made to articles through suggestions or direct edits
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading changes...</div>
          ) : changes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No changes found
            </div>
          ) : (
            <div className="space-y-4">
              {changes.map((change) => (
                <div
                  key={change.id}
                  className={`border rounded-lg p-4 ${
                    !change.isActive ? 'opacity-60 bg-muted/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={getChangeTypeColor(change.changeType)}
                          variant="secondary"
                        >
                          {change.changeType}
                        </Badge>
                        {change.isActive ? (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600">
                            <XCircle className="h-3 w-3 mr-1" />
                            Rolled Back
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-semibold">
                        <a
                          href={`/articles/${change.article.articleSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {change.article.articleTitle}
                        </a>
                      </h3>

                      <p className="text-sm text-muted-foreground">
                        {change.description}
                      </p>

                      {change.suggestion && (
                        <div className="text-sm bg-muted p-2 rounded">
                          <span className="font-medium">Suggestion:</span>{' '}
                          {change.suggestion.suggestionType} -{' '}
                          {change.suggestion.suggestionDetails.substring(0, 100)}...
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {getUserName(change.user)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(change.createdAt), {
                            addSuffix: true,
                          })}
                        </div>
                      </div>

                      {change.rolledBackAt && change.rollbackUser && (
                        <div className="text-sm text-orange-600 mt-1">
                          Rolled back by {getUserName(change.rollbackUser)}{' '}
                          {formatDistanceToNow(new Date(change.rolledBackAt), {
                            addSuffix: true,
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          router.push(
                            `/admin/articles/${change.articleId}/changes/${change.id}`
                          )
                        }
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        View Diff
                      </Button>
                      {change.isActive && change.changeType !== 'rollback' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRollback(change)}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Rollback
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pagination.hasMore && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => {
                  setPagination((prev) => ({
                    ...prev,
                    offset: prev.offset + prev.limit,
                  }));
                  loadChanges();
                }}
              >
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}