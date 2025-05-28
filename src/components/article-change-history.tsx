'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, User, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface Change {
  id: string;
  changeType: string;
  description: string;
  createdAt: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
  suggestion: {
    suggestionType: string;
  } | null;
}

interface ArticleInfo {
  articleTitle: string;
  createdAt: string;
  updatedAt: string;
}

interface ArticleChangeHistoryProps {
  articleId: string;
}

export function ArticleChangeHistory({ articleId }: ArticleChangeHistoryProps) {
  const [changes, setChanges] = useState<Change[]>([]);
  const [article, setArticle] = useState<ArticleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadChangeHistory();
  }, [articleId]);

  const loadChangeHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/articles/${articleId}/changes`);
      if (!response.ok) throw new Error('Failed to load change history');

      const data = await response.json();
      setChanges(data.changes);
      setArticle(data.article);
    } catch (error) {
      console.error('Error loading change history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (user: Change['user']) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return 'Anonymous';
  };

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'suggestion':
        return 'bg-blue-100 text-blue-800';
      case 'rollback':
        return 'bg-orange-100 text-orange-800';
      case 'admin_edit':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || !article || changes.length === 0) {
    return null;
  }

  const displayChanges = isExpanded ? changes : changes.slice(0, 3);

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Article History
        </CardTitle>
        <CardDescription>
          This article has been improved {changes.length} time{changes.length !== 1 ? 's' : ''} by our community
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground mb-4">
          <p>
            Created {format(new Date(article.createdAt), 'MMM d, yyyy')} • 
            Last updated {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true })}
          </p>
        </div>

        <div className="space-y-3">
          {displayChanges.map((change) => (
            <div
              key={change.id}
              className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0"
            >
              {change.user.imageUrl ? (
                <img
                  src={change.user.imageUrl}
                  alt={getUserName(change.user)}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-500" />
                </div>
              )}
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">
                    {getUserName(change.user)}
                  </span>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${getChangeTypeColor(change.changeType)}`}
                  >
                    {change.suggestion ? change.suggestion.suggestionType : change.changeType}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {change.description}
                </p>
                
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDistanceToNow(new Date(change.createdAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {changes.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show {changes.length - 3} More Changes
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}