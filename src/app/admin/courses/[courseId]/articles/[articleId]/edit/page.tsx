'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2, FileText, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import MarkdownViewer from '@/components/markdown-viewer';

interface CourseArticle {
  articleId: string;
  title: string;
  slug: string;
  description?: string;
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

export default function EditCourseArticlePage({ params }: PageProps) {
  const router = useRouter();
  const [courseArticle, setCourseArticle] = useState<CourseArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');

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
      setTitle(data.title);
      setDescription(data.description || '');
      setContent(data.contentHtml || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!courseArticle) return;
    
    try {
      setSaving(true);
      setError(null);
      
      const { courseId, articleId } = await params;
      
      const response = await fetch(`/api/admin/courses/${courseId}/articles/${articleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          contentHtml: content,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save changes');
      }
      
      router.push(`/admin/courses/${courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !courseArticle) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error || 'Course article not found'}</p>
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
            <h1 className="text-2xl font-bold">Edit Course Article</h1>
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

      {/* Editor/Preview Toggle */}
      <div className="mb-4">
        <div className="inline-flex rounded-lg border border-gray-200 p-1">
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              !showPreview
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setShowPreview(false)}
          >
            Edit
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              showPreview
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setShowPreview(true)}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6">
        {!showPreview ? (
          <>
            {/* Title */}
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
                placeholder="Article title"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
                rows={3}
                placeholder="Brief description of the article"
              />
            </div>

            {/* Content */}
            <div>
              <Label htmlFor="content">Content (Markdown)</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1 font-mono text-sm"
                rows={20}
                placeholder="Article content in Markdown format..."
              />
            </div>
          </>
        ) : (
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">{title}</h2>
            {description && (
              <p className="text-gray-600 mb-6">{description}</p>
            )}
            <div className="prose prose-lg max-w-none">
              <MarkdownViewer content={content} />
            </div>
          </Card>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/courses/${courseArticle.section.course.courseId}`)}
          >
            Cancel
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
}