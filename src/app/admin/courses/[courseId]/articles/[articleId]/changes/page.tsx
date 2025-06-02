'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, History, Loader2, AlertCircle, User, Calendar, FileText, RotateCcw } from 'lucide-react';
import Link from 'next/link';

interface CourseArticleChange {
  id: string;
  changeType: string;
  description: string;
  isActive: boolean;
  rolledBackAt?: string;
  createdAt: string;
  user: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

interface CourseArticle {
  articleId: string;
  title: string;
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

export default function CourseArticleChangesPage({ params }: PageProps) {
  const router = useRouter();
  const [article, setArticle] = useState<CourseArticle | null>(null);
  const [changes, setChanges] = useState<CourseArticleChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChanges();
  }, []);

  const fetchChanges = async () => {
    try {
      setLoading(true);
      const { courseId, articleId } = await params;
      
      // Fetch article details
      const articleResponse = await fetch(`/api/admin/courses/${courseId}/articles/${articleId}`);
      if (!articleResponse.ok) {
        throw new Error('Failed to fetch article');
      }
      const articleData = await articleResponse.json();
      setArticle(articleData);
      
      // Fetch changes
      const changesResponse = await fetch(`/api/admin/courses/${courseId}/articles/${articleId}/changes`);
      if (!changesResponse.ok) {
        throw new Error('Failed to fetch changes');
      }
      const changesData = await changesResponse.json();
      setChanges(changesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error || 'Article not found'}</p>
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Change History</h1>
            <p className="text-sm text-gray-600 mt-1">
              {article.section.course.title} / {article.section.title} / {article.title}
            </p>
          </div>
          <Link href={`/admin/courses/${article.section.course.courseId}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
          </Link>
        </div>
      </div>

      {/* Changes List */}
      {changes.length === 0 ? (
        <Card className="p-6">
          <div className="text-center text-gray-500">
            <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No changes recorded for this article yet.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {changes.map((change) => (
            <Card key={change.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-medium">{change.description}</h3>
                    <Badge variant={change.isActive ? 'default' : 'secondary'}>
                      {change.isActive ? 'Active' : change.rolledBackAt ? 'Rolled Back' : 'Inactive'}
                    </Badge>
                    {change.changeType === 'rollback' && (
                      <Badge variant="outline">
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Rollback
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>
                        {change.user.firstName} {change.user.lastName} ({change.user.email})
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(change.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {change.rolledBackAt && (
                    <p className="text-sm text-yellow-600 mt-2">
                      Rolled back on {new Date(change.rolledBackAt).toLocaleString()}
                    </p>
                  )}
                </div>
                
                <Link 
                  href={`/admin/courses/${article.section.course.courseId}/articles/${article.articleId}/changes/${change.id}`}
                >
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}