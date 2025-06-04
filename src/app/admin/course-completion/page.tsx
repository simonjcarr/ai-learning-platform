"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Settings, Award, Clock, Target, TrendingUp, HelpCircle } from "lucide-react";

interface CourseCompletionSettings {
  settingsId: string;
  bronzeThreshold: number;
  silverThreshold: number;
  goldThreshold: number;
  minEngagementScore: number;
  minQuizAverage: number;
  minArticlesCompletedPercent: number;
  finalExamRequired: boolean;
  finalExamCooldownHours: number;
}

interface QuizGenerationSettings {
  settingsId: string;
  articleQuizMinQuestions: number;
  articleQuizMaxQuestions: number;
  sectionQuizMinQuestions: number;
  sectionQuizMaxQuestions: number;
  finalExamMinQuestions: number;
  finalExamMaxQuestions: number;
}

interface QuestionPointSettings {
  settingsId: string;
  multipleChoicePoints: number;
  trueFalsePoints: number;
  fillInBlankPoints: number;
  essayMinPoints: number;
  essayMaxPoints: number;
  essayPassingThreshold: number;
}

export default function CourseCompletionSettingsPage() {
  const [settings, setSettings] = useState<CourseCompletionSettings | null>(null);
  const [quizSettings, setQuizSettings] = useState<QuizGenerationSettings | null>(null);
  const [pointSettings, setPointSettings] = useState<QuestionPointSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [completionResponse, quizResponse, pointResponse] = await Promise.all([
        fetch('/api/admin/course-completion/settings'),
        fetch('/api/admin/quiz-generation/settings'),
        fetch('/api/admin/question-point-settings')
      ]);
      
      if (!completionResponse.ok) throw new Error('Failed to fetch completion settings');
      if (!quizResponse.ok) throw new Error('Failed to fetch quiz generation settings');
      if (!pointResponse.ok) throw new Error('Failed to fetch question point settings');
      
      const completionData = await completionResponse.json();
      const quizData = await quizResponse.json();
      const pointData = await pointResponse.json();
      
      setSettings(completionData);
      setQuizSettings(quizData);
      setPointSettings(pointData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings || !quizSettings || !pointSettings) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const [completionResponse, quizResponse, pointResponse] = await Promise.all([
        fetch('/api/admin/course-completion/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        }),
        fetch('/api/admin/quiz-generation/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(quizSettings),
        }),
        fetch('/api/admin/question-point-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pointSettings),
        })
      ]);

      if (!completionResponse.ok) throw new Error('Failed to save completion settings');
      if (!quizResponse.ok) throw new Error('Failed to save quiz generation settings');
      if (!pointResponse.ok) throw new Error('Failed to save question point settings');
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof CourseCompletionSettings, value: number | boolean) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const updateQuizSetting = (key: keyof QuizGenerationSettings, value: number) => {
    if (!quizSettings) return;
    setQuizSettings({ ...quizSettings, [key]: value });
  };

  const updatePointSetting = (key: keyof QuestionPointSettings, value: number) => {
    if (!pointSettings) return;
    setPointSettings({ ...pointSettings, [key]: value });
  };

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
          <Settings className="h-8 w-8 text-orange-600" />
          <h1 className="text-3xl font-bold text-gray-900">Course Completion Settings</h1>
        </div>
        <p className="text-gray-600">
          Configure global requirements for course completion and certificate grading across all courses.
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

      <div className="space-y-8">
        {/* Certificate Grade Thresholds */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Award className="h-6 w-6 text-yellow-600" />
            <h2 className="text-xl font-semibold text-gray-900">Certificate Grade Thresholds</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="bronzeThreshold" className="flex items-center space-x-2">
                <Badge className="bg-orange-100 text-orange-800">Bronze</Badge>
                <span>Minimum Score (%)</span>
              </Label>
              <Input
                id="bronzeThreshold"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings?.bronzeThreshold || 0}
                onChange={(e) => updateSetting('bronzeThreshold', parseFloat(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="silverThreshold" className="flex items-center space-x-2">
                <Badge className="bg-gray-100 text-gray-800">Silver</Badge>
                <span>Minimum Score (%)</span>
              </Label>
              <Input
                id="silverThreshold"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings?.silverThreshold || 0}
                onChange={(e) => updateSetting('silverThreshold', parseFloat(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goldThreshold" className="flex items-center space-x-2">
                <Badge className="bg-yellow-100 text-yellow-800">Gold</Badge>
                <span>Minimum Score (%)</span>
              </Label>
              <Input
                id="goldThreshold"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings?.goldThreshold || 0}
                onChange={(e) => updateSetting('goldThreshold', parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Final scores are calculated based on engagement, quiz performance, 
              time investment, and interaction quality. Students must meet all minimum requirements 
              below in addition to these grade thresholds.
            </p>
          </div>
        </Card>

        {/* Engagement Requirements */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Engagement Requirements</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="minEngagementScore">Minimum Engagement Score (%)</Label>
              <Input
                id="minEngagementScore"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings?.minEngagementScore || 0}
                onChange={(e) => updateSetting('minEngagementScore', parseFloat(e.target.value))}
              />
              <p className="text-sm text-gray-600">
                Combined score from article reading time, scroll depth, and interactions
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minArticlesCompletedPercent">Articles Completed (%)</Label>
              <Input
                id="minArticlesCompletedPercent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings?.minArticlesCompletedPercent || 0}
                onChange={(e) => updateSetting('minArticlesCompletedPercent', parseFloat(e.target.value))}
              />
              <p className="text-sm text-gray-600">
                Percentage of course articles that must be completed
              </p>
            </div>
          </div>
        </Card>

        {/* Quiz Requirements */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Target className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Quiz Requirements</h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="minQuizAverage">Minimum Quiz Average (%)</Label>
              <Input
                id="minQuizAverage"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings?.minQuizAverage || 0}
                onChange={(e) => updateSetting('minQuizAverage', parseFloat(e.target.value))}
              />
              <p className="text-sm text-gray-600">
                Average score across all section quizzes (article quizzes are optional but boost score)
              </p>
            </div>
          </div>
        </Card>

        {/* Final Exam Settings */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Clock className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Final Exam Settings</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <Switch
                id="finalExamRequired"
                checked={settings?.finalExamRequired || false}
                onCheckedChange={(checked) => updateSetting('finalExamRequired', checked)}
              />
              <Label htmlFor="finalExamRequired">Require final exam for certificate</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="finalExamCooldownHours">Retake Cooldown (hours)</Label>
              <Input
                id="finalExamCooldownHours"
                type="number"
                min="0"
                max="168"
                value={settings?.finalExamCooldownHours || 0}
                onChange={(e) => updateSetting('finalExamCooldownHours', parseInt(e.target.value))}
              />
              <p className="text-sm text-gray-600">
                How long students must wait before retaking a failed final exam (0 = no cooldown)
              </p>
            </div>
          </div>
        </Card>

        {/* Default Question Bank Settings */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <HelpCircle className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">Default Question Bank Settings</h2>
          </div>

          <div className="space-y-4 mb-6">
            <p className="text-sm text-gray-600">
              These are the default settings for new courses. Each course can override these settings individually.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="finalExamMinQuestions">Default Question Bank Size</Label>
              <Input
                id="finalExamMinQuestions"
                type="number"
                min="1"
                max="500"
                value={quizSettings?.finalExamMinQuestions || 0}
                onChange={(e) => updateQuizSetting('finalExamMinQuestions', parseInt(e.target.value))}
              />
              <p className="text-sm text-gray-600">
                Total number of questions to generate in the question bank for each course
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="finalExamMaxQuestions">Default Essay Questions in Bank</Label>
              <Input
                id="finalExamMaxQuestions"
                type="number"
                min="0"
                max={quizSettings?.finalExamMinQuestions || 125}
                value={quizSettings?.finalExamMaxQuestions || 0}
                onChange={(e) => updateQuizSetting('finalExamMaxQuestions', parseInt(e.target.value))}
              />
              <p className="text-sm text-gray-600">
                Number of essay-style questions to include in the question bank
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-amber-50 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Changing these settings only affects new courses. Existing courses will 
              continue to use their individual settings. You can configure per-course settings from the course 
              management page.
            </p>
          </div>
        </Card>

        {/* Question Point Values */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Target className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">Question Point Values</h2>
          </div>

          <div className="space-y-4 mb-6">
            <p className="text-sm text-gray-600">
              Configure how many points each question type is worth and AI grading settings for essay questions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="multipleChoicePoints">Multiple Choice Points</Label>
              <Input
                id="multipleChoicePoints"
                type="number"
                min="0.1"
                max="20"
                step="0.1"
                value={pointSettings?.multipleChoicePoints || 0}
                onChange={(e) => updatePointSetting('multipleChoicePoints', parseFloat(e.target.value))}
              />
              <p className="text-sm text-gray-600">
                Points awarded for each multiple choice question
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trueFalsePoints">True/False Points</Label>
              <Input
                id="trueFalsePoints"
                type="number"
                min="0.1"
                max="20"
                step="0.1"
                value={pointSettings?.trueFalsePoints || 0}
                onChange={(e) => updatePointSetting('trueFalsePoints', parseFloat(e.target.value))}
              />
              <p className="text-sm text-gray-600">
                Points awarded for each true/false question
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fillInBlankPoints">Fill in Blank Points</Label>
              <Input
                id="fillInBlankPoints"
                type="number"
                min="0.1"
                max="20"
                step="0.1"
                value={pointSettings?.fillInBlankPoints || 0}
                onChange={(e) => updatePointSetting('fillInBlankPoints', parseFloat(e.target.value))}
              />
              <p className="text-sm text-gray-600">
                Points awarded for each fill-in-the-blank question
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="essayPassingThreshold">Essay Passing Threshold</Label>
              <Input
                id="essayPassingThreshold"
                type="number"
                min="0.1"
                max="1.0"
                step="0.05"
                value={pointSettings?.essayPassingThreshold || 0}
                onChange={(e) => updatePointSetting('essayPassingThreshold', parseFloat(e.target.value))}
              />
              <p className="text-sm text-gray-600">
                Minimum score (0.0-1.0) for essays to be considered &quot;correct&quot;
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="essayMinPoints">Essay Minimum Points</Label>
              <Input
                id="essayMinPoints"
                type="number"
                min="0.1"
                max="50"
                step="0.1"
                value={pointSettings?.essayMinPoints || 0}
                onChange={(e) => updatePointSetting('essayMinPoints', parseFloat(e.target.value))}
              />
              <p className="text-sm text-gray-600">
                Minimum points that can be awarded for essay questions
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="essayMaxPoints">Essay Maximum Points</Label>
              <Input
                id="essayMaxPoints"
                type="number"
                min="0.1"
                max="50"
                step="0.1"
                value={pointSettings?.essayMaxPoints || 0}
                onChange={(e) => updatePointSetting('essayMaxPoints', parseFloat(e.target.value))}
              />
              <p className="text-sm text-gray-600">
                Maximum points that can be awarded for essay questions
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-800">
              <strong>AI Essay Grading:</strong> Essay questions are automatically graded by AI, which evaluates 
              accuracy, completeness, understanding, and explanation quality. The AI awards points within the 
              configured range based on answer quality and provides detailed feedback to students.
            </p>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
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