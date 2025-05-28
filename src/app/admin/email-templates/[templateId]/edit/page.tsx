"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

interface Variable {
  name: string;
  description: string;
  defaultValue?: string;
}

export default function EditEmailTemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
  const router = useRouter();
  const { templateId } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    templateName: "",
    description: "",
    subject: "",
    htmlContent: "",
    textContent: "",
    fromEmail: "",
    fromName: "",
    isActive: true,
  });
  const [variables, setVariables] = useState<Variable[]>([]);

  useEffect(() => {
    fetchTemplate();
  }, [templateId]);

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}`);
      if (!response.ok) throw new Error("Failed to fetch template");
      
      const template = await response.json();
      setFormData({
        templateName: template.templateName,
        description: template.description || "",
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent || "",
        fromEmail: template.fromEmail || "",
        fromName: template.fromName || "",
        isActive: template.isActive,
      });
      
      if (template.variables && Array.isArray(template.variables)) {
        setVariables(template.variables);
      }
    } catch (error) {
      toast.error("Failed to load template");
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          variables: variables.length > 0 ? variables : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update template");
      }

      toast.success("Email template updated successfully");
      router.push("/admin/email-templates");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update template");
      console.error("Error:", error);
    } finally {
      setSaving(false);
    }
  };

  const addVariable = () => {
    setVariables([...variables, { name: "", description: "", defaultValue: "" }]);
  };

  const updateVariable = (index: number, field: keyof Variable, value: string) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: value };
    setVariables(updated);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading template...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Email Template</h1>
        <p className="text-gray-600 mt-2">Update the email template configuration</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
            <CardDescription>Basic information about the email template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                value={formData.templateName}
                onChange={(e) => setFormData({ ...formData, templateName: e.target.value })}
                placeholder="Welcome Email"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Email sent to new users when they sign up"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fromEmail">From Email (Optional)</Label>
                <Input
                  id="fromEmail"
                  type="email"
                  value={formData.fromEmail}
                  onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                  placeholder="noreply@example.com"
                />
              </div>
              <div>
                <Label htmlFor="fromName">From Name (Optional)</Label>
                <Input
                  id="fromName"
                  value={formData.fromName}
                  onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                  placeholder="IT Learning Platform"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Template is active</Label>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Email Content</CardTitle>
            <CardDescription>The subject and body of the email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Welcome to IT Learning Platform, {{firstName}}!"
                required
              />
            </div>

            <div>
              <Label htmlFor="htmlContent">HTML Content</Label>
              <Textarea
                id="htmlContent"
                value={formData.htmlContent}
                onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                placeholder="<h1>Welcome {{firstName}}!</h1><p>Thanks for joining...</p>"
                rows={10}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Use {"{{variable}}"} syntax for dynamic content</p>
            </div>

            <div>
              <Label htmlFor="textContent">Text Content (Optional)</Label>
              <Textarea
                id="textContent"
                value={formData.textContent}
                onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
                placeholder="Welcome {{firstName}}! Thanks for joining..."
                rows={6}
              />
              <p className="text-xs text-gray-500 mt-1">Plain text version for email clients that don't support HTML</p>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Template Variables</CardTitle>
                <CardDescription>Define variables that can be used in the template</CardDescription>
              </div>
              <Button type="button" onClick={addVariable} size="sm">
                Add Variable
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {variables.map((variable, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <Input
                  placeholder="Variable name"
                  value={variable.name}
                  onChange={(e) => updateVariable(index, "name", e.target.value)}
                />
                <Input
                  placeholder="Description"
                  value={variable.description}
                  onChange={(e) => updateVariable(index, "description", e.target.value)}
                />
                <Input
                  placeholder="Default value"
                  value={variable.defaultValue}
                  onChange={(e) => updateVariable(index, "defaultValue", e.target.value)}
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeVariable(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
            {variables.length === 0 && (
              <p className="text-sm text-gray-500">No variables defined</p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between mt-6">
          <Link href="/admin/email-templates">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}