"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

interface EmailTemplate {
  templateId: string;
  templateKey: string;
  templateName: string;
  description: string | null;
  subject: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    emailLogs: number;
  };
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/admin/email-templates");
      if (!response.ok) throw new Error("Failed to fetch templates");
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      toast.error("Failed to load email templates");
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete template");

      toast.success("Template deleted successfully");
      fetchTemplates();
    } catch (error) {
      toast.error("Failed to delete template");
      console.error("Error:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading templates...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-gray-600 mt-2">Manage email templates for the platform</p>
        </div>
        <div className="space-x-4">
          <Link href="/admin/email-logs">
            <Button variant="outline">View Email Logs</Button>
          </Link>
          <Link href="/admin/email-templates/new">
            <Button>Create Template</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.templateId}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{template.templateName}</CardTitle>
                  <CardDescription className="mt-1">
                    Key: <code className="text-sm bg-gray-100 px-2 py-1 rounded">{template.templateKey}</code>
                  </CardDescription>
                  {template.description && (
                    <p className="text-sm text-gray-600 mt-2">{template.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={template.isActive ? "default" : "secondary"}>
                    {template.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline">
                    {template._count.emailLogs} sent
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <p className="text-sm text-gray-600">Subject:</p>
                <p className="font-medium">{template.subject}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/email-templates/${template.templateId}/edit`}>
                  <Button size="sm">Edit</Button>
                </Link>
                <Link href={`/admin/email-templates/${template.templateId}/test`}>
                  <Button size="sm" variant="outline">Send Test</Button>
                </Link>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(template.templateId)}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600 mb-4">No email templates found</p>
            <Link href="/admin/email-templates/new">
              <Button>Create Your First Template</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}