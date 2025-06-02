"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Role, CourseLevel } from "@prisma/client";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

export default function NewCoursePage() {
  const { hasMinRole } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    systemPromptTitle: "",
    systemPromptDescription: "",
    level: CourseLevel.BEGINNER,
    estimatedHours: "",
    passMarkPercentage: "70",
  });

  // Check permissions
  if (!hasMinRole(Role.ADMIN)) {
    notFound();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPromptTitle: formData.systemPromptTitle,
          systemPromptDescription: formData.systemPromptDescription,
          level: formData.level,
          estimatedHours: formData.estimatedHours ? parseInt(formData.estimatedHours) : null,
          passMarkPercentage: parseFloat(formData.passMarkPercentage),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create course');
      }

      const course = await response.json();
      
      // Redirect to the course detail page
      router.push(`/admin/courses/${course.courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/admin/courses">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Course</h1>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <Label htmlFor="systemPromptTitle">AI Generation Prompt - Topic/Title *</Label>
            <Input
              id="systemPromptTitle"
              type="text"
              value={formData.systemPromptTitle}
              onChange={(e) => handleInputChange('systemPromptTitle', e.target.value)}
              placeholder="e.g., 'Advanced Kubernetes Security Best Practices'"
              required
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              This prompt will guide the AI to generate an appropriate course title and structure.
              Be specific about the topic and scope.
            </p>
          </div>

          <div>
            <Label htmlFor="systemPromptDescription">AI Generation Prompt - Detailed Requirements *</Label>
            <Textarea
              id="systemPromptDescription"
              value={formData.systemPromptDescription}
              onChange={(e) => handleInputChange('systemPromptDescription', e.target.value)}
              placeholder="Describe the course requirements, target audience, key topics to cover, learning objectives, and any specific technologies or concepts that must be included"
              required
              rows={6}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              This detailed prompt will guide the AI to generate comprehensive course content.
              Include target audience, prerequisites, key topics, and desired outcomes.
              The AI will use this to create an appropriate course title, description, and full curriculum.
            </p>
          </div>

          <div>
            <Label htmlFor="level">Difficulty Level *</Label>
            <select
              id="level"
              value={formData.level}
              onChange={(e) => handleInputChange('level', e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
            >
              <option value={CourseLevel.BEGINNER}>Beginner</option>
              <option value={CourseLevel.INTERMEDIATE}>Intermediate</option>
              <option value={CourseLevel.ADVANCED}>Advanced</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              This affects the complexity and depth of generated content
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="estimatedHours">Estimated Hours</Label>
              <Input
                id="estimatedHours"
                type="number"
                min="1"
                max="1000"
                value={formData.estimatedHours}
                onChange={(e) => handleInputChange('estimatedHours', e.target.value)}
                placeholder="e.g., 10"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional: How long you estimate it will take to complete this course
              </p>
            </div>

            <div>
              <Label htmlFor="passMarkPercentage">Pass Mark Percentage *</Label>
              <Input
                id="passMarkPercentage"
                type="number"
                min="1"
                max="100"
                step="0.1"
                value={formData.passMarkPercentage}
                onChange={(e) => handleInputChange('passMarkPercentage', e.target.value)}
                required
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum score required to pass quizzes and earn certificate
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">What happens next?</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• AI will generate a comprehensive course outline with sections and articles</li>
              <li>• Course structure will be created automatically based on your description</li>
              <li>• Article content will be generated progressively when students access them</li>
              <li>• Quizzes will be created for each article and section</li>
              <li>• You can review and modify any generated content before publishing</li>
            </ul>
          </div>

          <div className="flex justify-end space-x-3">
            <Link href="/admin/courses">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Course...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Course
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}