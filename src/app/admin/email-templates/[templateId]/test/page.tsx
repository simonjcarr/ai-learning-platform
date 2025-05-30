"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";

interface Variable {
  name: string;
  description: string;
  defaultValue?: string;
}

interface Template {
  templateId: string;
  templateName: string;
  templateKey: string;
  subject: string;
  variables?: Variable[];
}

export default function TestEmailTemplatePage() {
  const params = useParams();
  const templateId = params.templateId as string;
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTemplate();
  }, [templateId]);

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}`);
      if (!response.ok) throw new Error("Failed to fetch template");
      
      const data = await response.json();
      setTemplate(data);
      
      // Initialize variables with default values
      if (data.variables && Array.isArray(data.variables)) {
        const defaultVars: Record<string, string> = {};
        data.variables.forEach((v: Variable) => {
          defaultVars[v.name] = v.defaultValue || "";
        });
        setVariables(defaultVars);
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
    setSending(true);

    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientEmail,
          variables: Object.keys(variables).length > 0 ? variables : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send test email");
      }

      await response.json();
      toast.success("Test email sent successfully!");
      
      // Clear form
      setRecipientEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send test email");
      console.error("Error:", error);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading template...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Template not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Test Email Template</h1>
        <p className="text-gray-600 mt-2">Send a test email using: {template.templateName}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>Configure the test email parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="recipientEmail">Recipient Email</Label>
              <Input
                id="recipientEmail"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="test@example.com"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Email address to send the test to</p>
            </div>

            {template.variables && template.variables.length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium">Template Variables</h3>
                {template.variables.map((variable) => (
                  <div key={variable.name}>
                    <Label htmlFor={variable.name}>
                      {variable.name}
                      {variable.description && (
                        <span className="text-xs text-gray-500 ml-2">({variable.description})</span>
                      )}
                    </Label>
                    <Input
                      id={variable.name}
                      value={variables[variable.name] || ""}
                      onChange={(e) => setVariables({ ...variables, [variable.name]: e.target.value })}
                      placeholder={variable.defaultValue || `Enter ${variable.name}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>What will be sent</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-gray-600">Subject:</p>
                <p className="text-sm">{processVariables(template.subject, variables)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between mt-6">
          <Link href="/admin/email-templates">
            <Button type="button" variant="outline">Back to Templates</Button>
          </Link>
          <Button type="submit" disabled={sending}>
            {sending ? "Sending..." : "Send Test Email"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function processVariables(template: string, variables: Record<string, string>): string {
  let processed = template;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    processed = processed.replace(regex, value);
  });
  return processed;
}