"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

interface Variable {
  name: string;
  description: string;
  defaultValue?: string;
}

export default function NewEmailTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    templateKey: "",
    templateName: "",
    description: "",
    subject: "",
    htmlContent: "",
    textContent: "",
    fromEmail: "",
    fromName: "",
  });
  const [variables, setVariables] = useState<Variable[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Clean up form data - convert empty strings to undefined for optional fields
      const cleanedData = {
        templateKey: formData.templateKey,
        templateName: formData.templateName,
        description: formData.description || undefined,
        subject: formData.subject,
        htmlContent: formData.htmlContent,
        textContent: formData.textContent || undefined,
        fromEmail: formData.fromEmail || undefined,
        fromName: formData.fromName || undefined,
        variables: variables.length > 0 ? variables.filter(v => v.name && v.description) : undefined,
      };

      const response = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create template");
      }

      toast.success("Email template created successfully");
      router.push("/admin/email-templates");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create template");
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

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create Email Template</h1>
        <p className="text-gray-600 mt-2">Create a new email template for the platform</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
            <CardDescription>Basic information about the email template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="templateKey">Template Key</Label>
                <Input
                  id="templateKey"
                  value={formData.templateKey}
                  onChange={(e) => setFormData({ ...formData, templateKey: e.target.value })}
                  placeholder="welcome_email"
                  required
                  pattern="[a-z0-9_]+"
                  title="Lowercase letters, numbers, and underscores only"
                />
                <p className="text-xs text-gray-500 mt-1">Unique identifier for the template</p>
              </div>
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
              <p className="text-xs text-gray-500 mt-1">Plain text version for email clients that don&apos;t support HTML</p>
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
            {saving ? "Creating..." : "Create Template"}
          </Button>
        </div>
      </form>
    </div>
  );
}