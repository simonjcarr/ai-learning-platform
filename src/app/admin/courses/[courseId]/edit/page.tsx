"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Role, CourseLevel, CourseStatus } from "@prisma/client";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

interface Course {
  courseId: string;
  title: string;
  slug: string;
  description: string;
  systemPromptTitle?: string;
  systemPromptDescription?: string;
  level: CourseLevel;
  status: CourseStatus;
  estimatedHours?: number;
  passMarkPercentage: number;
}

export default function EditCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { hasMinRole } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Unwrap the params promise
  const { courseId } = use(params);

  // Check permissions
  if (!hasMinRole(Role.ADMIN)) {
    notFound();
  }

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    systemPromptTitle: '',
    systemPromptDescription: '',
    level: CourseLevel.BEGINNER,
    status: CourseStatus.DRAFT,
    estimatedHours: 0,
    passMarkPercentage: 70,
  });

  useEffect(() => {
    fetchCourse();
  }, [courseId]);

  const fetchCourse = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/courses/${courseId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          notFound();
        }
        throw new Error('Failed to fetch course');
      }
      
      const data = await response.json();
      setCourse(data);
      setFormData({
        title: data.title,
        description: data.description,
        systemPromptTitle: data.systemPromptTitle || '',
        systemPromptDescription: data.systemPromptDescription || '',
        level: data.level,
        status: data.status,
        estimatedHours: data.estimatedHours || 0,
        passMarkPercentage: data.passMarkPercentage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/admin/courses/${courseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update course');
      }

      // Redirect back to course detail
      router.push(`/admin/courses/${courseId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update course');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href={`/admin/courses/${courseId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href={`/admin/courses/${courseId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
          </Link>
        </div>
        <Card className="p-6">
          <div className="text-center text-red-600">
            Error loading course: {error || 'Course not found'}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/admin/courses/${courseId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Edit Course</h1>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <Label htmlFor="title">Course Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter course title"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter course description"
              rows={4}
            />
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-4">AI Generation Settings</h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="systemPromptTitle">AI Generation Prompt - Topic/Title</Label>
                <Input
                  id="systemPromptTitle"
                  value={formData.systemPromptTitle}
                  onChange={(e) => handleInputChange('systemPromptTitle', e.target.value)}
                  placeholder="e.g., 'Advanced Kubernetes Security Best Practices'"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The topic/title prompt used by AI to generate course content
                </p>
              </div>

              <div>
                <Label htmlFor="systemPromptDescription">AI Generation Prompt - Detailed Requirements</Label>
                <Textarea
                  id="systemPromptDescription"
                  value={formData.systemPromptDescription}
                  onChange={(e) => handleInputChange('systemPromptDescription', e.target.value)}
                  placeholder="Detailed requirements for AI generation..."
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  The detailed prompt used by AI to generate course structure and content
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="level">Level</Label>
              <select
                id="level"
                value={formData.level}
                onChange={(e) => handleInputChange('level', e.target.value as CourseLevel)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value={CourseLevel.BEGINNER}>Beginner</option>
                <option value={CourseLevel.INTERMEDIATE}>Intermediate</option>
                <option value={CourseLevel.ADVANCED}>Advanced</option>
              </select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value as CourseStatus)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value={CourseStatus.DRAFT}>Draft</option>
                <option value={CourseStatus.PUBLISHED}>Published</option>
                <option value={CourseStatus.ARCHIVED}>Archived</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="estimatedHours">Estimated Hours</Label>
              <Input
                id="estimatedHours"
                type="number"
                value={formData.estimatedHours}
                onChange={(e) => handleInputChange('estimatedHours', parseInt(e.target.value) || 0)}
                placeholder="0"
                min="0"
              />
            </div>

            <div>
              <Label htmlFor="passMarkPercentage">Pass Mark Percentage</Label>
              <Input
                id="passMarkPercentage"
                type="number"
                value={formData.passMarkPercentage}
                onChange={(e) => handleInputChange('passMarkPercentage', parseInt(e.target.value) || 70)}
                placeholder="70"
                min="0"
                max="100"
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}