"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, HelpCircle, BookOpen, FileText, Award } from "lucide-react";

interface QuizGenerationSettings {
  settingsId: string;
  articleQuizMinQuestions: number;
  articleQuizMaxQuestions: number;
  sectionQuizMinQuestions: number;
  sectionQuizMaxQuestions: number;
  finalExamMinQuestions: number;
  finalExamMaxQuestions: number;
}

export default function QuizGenerationSettingsPage() {
  const [settings, setSettings] = useState<QuizGenerationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/quiz-generation/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/admin/quiz-generation/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof QuizGenerationSettings, value: number) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const validateRange = (min: number, max: number, type: string): string | null => {
    if (min > max) {
      return `${type}: Minimum cannot be greater than maximum`;
    }
    if (min < 1) {
      return `${type}: Minimum must be at least 1`;
    }
    if (max > 50) {
      return `${type}: Maximum cannot exceed 50 questions`;
    }
    return null;
  };

  const getValidationErrors = (): string[] => {
    if (!settings) return [];
    
    const errors: string[] = [];
    
    const articleError = validateRange(
      settings.articleQuizMinQuestions,
      settings.articleQuizMaxQuestions,
      "Article Quiz"
    );
    if (articleError) errors.push(articleError);

    const sectionError = validateRange(
      settings.sectionQuizMinQuestions,
      settings.sectionQuizMaxQuestions,
      "Section Quiz"
    );
    if (sectionError) errors.push(sectionError);

    const finalError = validateRange(
      settings.finalExamMinQuestions,
      settings.finalExamMaxQuestions,
      "Final Exam"
    );
    if (finalError) errors.push(finalError);

    return errors;
  };

  const validationErrors = getValidationErrors();
  const hasValidationErrors = validationErrors.length > 0;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="p-6">
          <div className="text-center text-red-600">Error: {error}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <HelpCircle className="h-8 w-8 text-orange-600" />
          <h1 className="text-3xl font-bold text-gray-900">Quiz Generation Settings</h1>
        </div>
        <p className="text-gray-600">
          Configure the number of questions generated for different quiz types. 
          The system will randomly select a number within your specified range.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">Settings saved successfully!</p>
        </div>
      )}

      {hasValidationErrors && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 font-medium mb-2">Please fix the following errors:</p>
          <ul className="list-disc list-inside space-y-1 text-yellow-700">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-8">
        {/* Article Quizzes */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <FileText className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Article Quizzes</h2>
            <Badge variant="outline">Optional</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="articleQuizMin">Minimum Questions</Label>
              <Input
                id="articleQuizMin"
                type="number"
                min="1"
                max="20"
                value={settings?.articleQuizMinQuestions || 0}
                onChange={(e) => updateSetting('articleQuizMinQuestions', parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="articleQuizMax">Maximum Questions</Label>
              <Input
                id="articleQuizMax"
                type="number"
                min="1"
                max="20"
                value={settings?.articleQuizMaxQuestions || 0}
                onChange={(e) => updateSetting('articleQuizMaxQuestions', parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Article quizzes</strong> are generated for individual course articles. 
              They help reinforce specific concepts and are optional for course completion but boost engagement scores.
            </p>
          </div>
        </Card>

        {/* Section Quizzes */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <BookOpen className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Section Quizzes</h2>
            <Badge className="bg-green-100 text-green-800">Required</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="sectionQuizMin">Minimum Questions</Label>
              <Input
                id="sectionQuizMin"
                type="number"
                min="1"
                max="25"
                value={settings?.sectionQuizMinQuestions || 0}
                onChange={(e) => updateSetting('sectionQuizMinQuestions', parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sectionQuizMax">Maximum Questions</Label>
              <Input
                id="sectionQuizMax"
                type="number"
                min="1"
                max="25"
                value={settings?.sectionQuizMaxQuestions || 0}
                onChange={(e) => updateSetting('sectionQuizMaxQuestions', parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Section quizzes</strong> test understanding of entire course sections. 
              All section quizzes must be completed with passing scores for course completion.
            </p>
          </div>
        </Card>

        {/* Final Exams */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Award className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Final Exams</h2>
            <Badge className="bg-purple-100 text-purple-800">Certificate Required</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="finalExamMin">Minimum Questions</Label>
              <Input
                id="finalExamMin"
                type="number"
                min="10"
                max="50"
                value={settings?.finalExamMinQuestions || 0}
                onChange={(e) => updateSetting('finalExamMinQuestions', parseInt(e.target.value) || 10)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="finalExamMax">Maximum Questions</Label>
              <Input
                id="finalExamMax"
                type="number"
                min="10"
                max="50"
                value={settings?.finalExamMaxQuestions || 0}
                onChange={(e) => updateSetting('finalExamMaxQuestions', parseInt(e.target.value) || 10)}
              />
            </div>
          </div>

          <div className="mt-4 p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-800">
              <strong>Final exams</strong> are comprehensive tests covering the entire course content. 
              They are required for certificate issuance and determine the certificate grade (Bronze/Silver/Gold).
            </p>
          </div>
        </Card>

        {/* Preview */}
        <Card className="p-6 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Question Range Preview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Article Quizzes:</span>
              <span className="font-medium">
                {settings?.articleQuizMinQuestions} - {settings?.articleQuizMaxQuestions} questions
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Section Quizzes:</span>
              <span className="font-medium">
                {settings?.sectionQuizMinQuestions} - {settings?.sectionQuizMaxQuestions} questions
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Final Exams:</span>
              <span className="font-medium">
                {settings?.finalExamMinQuestions} - {settings?.finalExamMaxQuestions} questions
              </span>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving || hasValidationErrors} 
            size="lg"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}