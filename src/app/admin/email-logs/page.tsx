"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { format } from "date-fns";

interface EmailLog {
  logId: string;
  templateId: string | null;
  to: string;
  from: string;
  subject: string;
  status: string;
  messageId: string | null;
  error: string | null;
  sentAt: string;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  complainedAt: string | null;
  template: {
    templateName: string;
    templateKey: string;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    to: "",
  });

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, filters]);

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.status) params.append("status", filters.status);
      if (filters.to) params.append("to", filters.to);

      const response = await fetch(`/api/admin/email-logs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch logs");
      
      const data = await response.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDING: "secondary",
      SENT: "default",
      DELIVERED: "default",
      OPENED: "default",
      CLICKED: "default",
      BOUNCED: "destructive",
      FAILED: "destructive",
      COMPLAINED: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading email logs...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Email Logs</h1>
          <p className="text-gray-600 mt-2">Track sent emails and their delivery status</p>
        </div>
        <Link href="/admin/email-templates">
          <Button variant="outline">Back to Templates</Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) => {
                  setFilters({ ...filters, status: value === "all" ? "" : value });
                  setPagination({ ...pagination, page: 1 });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                  <SelectItem value="OPENED">Opened</SelectItem>
                  <SelectItem value="CLICKED">Clicked</SelectItem>
                  <SelectItem value="BOUNCED">Bounced</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="COMPLAINED">Complained</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Input
                placeholder="Filter by recipient email"
                value={filters.to}
                onChange={(e) => {
                  setFilters({ ...filters, to: e.target.value });
                  setPagination({ ...pagination, page: 1 });
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {logs.map((log) => (
          <Card key={log.logId}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-medium">{log.subject}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    To: {log.to} • From: {log.from}
                  </p>
                  {log.template && (
                    <p className="text-sm text-gray-500 mt-1">
                      Template: {log.template.templateName}
                    </p>
                  )}
                </div>
                {getStatusBadge(log.status)}
              </div>

              <div className="text-sm text-gray-600">
                <p>Sent: {format(new Date(log.sentAt), "PPp")}</p>
                {log.deliveredAt && (
                  <p>Delivered: {format(new Date(log.deliveredAt), "PPp")}</p>
                )}
                {log.openedAt && (
                  <p>Opened: {format(new Date(log.openedAt), "PPp")}</p>
                )}
                {log.error && (
                  <p className="text-red-600 mt-2">Error: {log.error}</p>
                )}
              </div>

              {log.messageId && (
                <p className="text-xs text-gray-500 mt-4">
                  Message ID: {log.messageId}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {logs.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600">No email logs found</p>
          </CardContent>
        </Card>
      )}

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <Button
            variant="outline"
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
            disabled={pagination.page === 1}
          >
            Previous
          </Button>
          <span className="px-4 py-2">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
            disabled={pagination.page === pagination.pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}