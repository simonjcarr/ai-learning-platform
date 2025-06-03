"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Role } from "@prisma/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Trash2, Play, RotateCcw, Settings, AlertCircle, CheckCircle, Clock, Pause, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface JobData {
  id: string;
  name: string;
  data: any;
  opts: any;
  status: string;
  queue: string;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  attemptsMade: number;
  failedReason?: string;
  returnvalue?: any;
  delay?: number;
  progress?: number;
}

interface QueueData {
  queue: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  jobs: JobData[];
  error?: string;
}

interface BullMQConfig {
  configId: string;
  emailQueueAttempts: number;
  emailQueueBackoffDelay: number;
  courseGenerationAttempts: number;
  courseGenerationBackoffDelay: number;
  sitemapQueueAttempts: number;
  sitemapQueueBackoffDelay: number;
  rateLimitRetrySeconds: number;
  maxBackoffMinutes: number;
}

export default function BullMQManagementPage() {
  const { hasMinRole } = useAuth();
  const [queues, setQueues] = useState<QueueData[]>([]);
  const [config, setConfig] = useState<BullMQConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showConfig, setShowConfig] = useState(false);
  
  // Check permissions
  if (!hasMinRole(Role.ADMIN)) {
    notFound();
  }

  useEffect(() => {
    fetchJobs();
    fetchConfig();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [selectedQueue, selectedStatus]);

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedQueue !== 'all') params.append('queue', selectedQueue);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      
      const response = await fetch(`/api/admin/bullmq/jobs?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }
      
      const data = await response.json();
      setQueues(data.queues);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/bullmq/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  };

  const updateConfig = async (updatedConfig: Partial<BullMQConfig>) => {
    try {
      setIsConfigLoading(true);
      const response = await fetch('/api/admin/bullmq/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedConfig),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update configuration');
      }

      const data = await response.json();
      setConfig(data.config);
      alert('Configuration updated successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update configuration');
    } finally {
      setIsConfigLoading(false);
    }
  };

  const removeJob = async (jobId: string, queueName: string) => {
    if (!confirm(`Are you sure you want to remove job ${jobId}?`)) return;

    try {
      const response = await fetch(`/api/admin/bullmq/jobs/${jobId}?queue=${queueName}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove job');
      }

      alert('Job removed successfully');
      fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove job');
    }
  };

  const retryJob = async (jobId: string, queueName: string) => {
    try {
      const response = await fetch(`/api/admin/bullmq/jobs/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'retry', queueName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to retry job');
      }

      alert('Job retried successfully');
      fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to retry job');
    }
  };

  const promoteJob = async (jobId: string, queueName: string) => {
    try {
      const response = await fetch(`/api/admin/bullmq/jobs/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'promote', queueName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to promote job');
      }

      alert('Job promoted successfully');
      fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to promote job');
    }
  };

  const clearQueue = async (queueName: string, status: string = 'all') => {
    const confirmMsg = status === 'all' 
      ? `Are you sure you want to clear ALL jobs from the ${queueName} queue?`
      : `Are you sure you want to clear all ${status} jobs from the ${queueName} queue?`;
    
    if (!confirm(confirmMsg)) return;

    try {
      const params = new URLSearchParams({ queue: queueName, status });
      const response = await fetch(`/api/admin/bullmq/queue?${params.toString()}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear queue');
      }

      const data = await response.json();
      alert(data.message);
      fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to clear queue');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'active':
        return <Badge className="bg-blue-100 text-blue-800"><Play className="h-3 w-3 mr-1" />Active</Badge>;
      case 'waiting':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Waiting</Badge>;
      case 'delayed':
        return <Badge className="bg-purple-100 text-purple-800"><Pause className="h-3 w-3 mr-1" />Delayed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const totalJobs = queues.reduce((total, queue) => 
    total + Object.values(queue.counts).reduce((sum, count) => sum + count, 0), 0
  );

  if (isLoading && queues.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">BullMQ Management</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">BullMQ Management</h1>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => setShowConfig(!showConfig)}
            variant="outline"
            size="sm"
          >
            <Settings className="h-4 w-4 mr-2" />
            {showConfig ? 'Hide' : 'Show'} Config
          </Button>
          <Button onClick={fetchJobs} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center text-red-600">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {error}
          </div>
        </Card>
      )}

      {/* Configuration Panel */}
      {showConfig && config && (
        <Card className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Queue Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="emailAttempts">Email Queue Attempts</Label>
              <Input
                id="emailAttempts"
                type="number"
                value={config.emailQueueAttempts}
                onChange={(e) => setConfig({...config, emailQueueAttempts: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="emailBackoff">Email Backoff Delay (ms)</Label>
              <Input
                id="emailBackoff"
                type="number"
                value={config.emailQueueBackoffDelay}
                onChange={(e) => setConfig({...config, emailQueueBackoffDelay: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="courseAttempts">Course Gen Attempts</Label>
              <Input
                id="courseAttempts"
                type="number"
                value={config.courseGenerationAttempts}
                onChange={(e) => setConfig({...config, courseGenerationAttempts: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="courseBackoff">Course Gen Backoff (ms)</Label>
              <Input
                id="courseBackoff"
                type="number"
                value={config.courseGenerationBackoffDelay}
                onChange={(e) => setConfig({...config, courseGenerationBackoffDelay: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="sitemapAttempts">Sitemap Attempts</Label>
              <Input
                id="sitemapAttempts"
                type="number"
                value={config.sitemapQueueAttempts}
                onChange={(e) => setConfig({...config, sitemapQueueAttempts: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="sitemapBackoff">Sitemap Backoff (ms)</Label>
              <Input
                id="sitemapBackoff"
                type="number"
                value={config.sitemapQueueBackoffDelay}
                onChange={(e) => setConfig({...config, sitemapQueueBackoffDelay: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="rateLimitRetry">Rate Limit Retry (s)</Label>
              <Input
                id="rateLimitRetry"
                type="number"
                value={config.rateLimitRetrySeconds}
                onChange={(e) => setConfig({...config, rateLimitRetrySeconds: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="maxBackoff">Max Backoff (min)</Label>
              <Input
                id="maxBackoff"
                type="number"
                value={config.maxBackoffMinutes}
                onChange={(e) => setConfig({...config, maxBackoffMinutes: parseInt(e.target.value)})}
              />
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={() => updateConfig(config)}
              disabled={isConfigLoading}
            >
              {isConfigLoading ? 'Updating...' : 'Update Configuration'}
            </Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <Label htmlFor="queue-select">Queue</Label>
              <select
                id="queue-select"
                value={selectedQueue}
                onChange={(e) => setSelectedQueue(e.target.value)}
                className="mt-1 block w-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Queues</option>
                <option value="email">Email</option>
                <option value="course-generation">Course Generation</option>
                <option value="sitemap">Sitemap</option>
              </select>
            </div>
            <div>
              <Label htmlFor="status-select">Status</Label>
              <select
                id="status-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="mt-1 block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Status</option>
                <option value="waiting">Waiting</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="delayed">Delayed</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Total Jobs: {totalJobs}
          </div>
        </div>
      </Card>

      {/* Queue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {queues.map((queueData) => (
          <Card key={queueData.queue} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900 capitalize">{queueData.queue} Queue</h3>
              <Button
                onClick={() => clearQueue(queueData.queue)}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {queueData.error ? (
              <div className="text-red-600 text-sm">{queueData.error}</div>
            ) : (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Waiting:</span>
                  <span className="font-medium">{queueData.counts.waiting}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active:</span>
                  <span className="font-medium">{queueData.counts.active}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed:</span>
                  <span className="font-medium">{queueData.counts.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed:</span>
                  <span className="font-medium">{queueData.counts.failed}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delayed:</span>
                  <span className="font-medium">{queueData.counts.delayed}</span>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Job Details */}
      <Card className="p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Job Details</h2>
        {queues.length === 0 || queues.every(q => q.jobs.length === 0) ? (
          <div className="text-center text-gray-500 py-8">
            No jobs found matching the current filters.
          </div>
        ) : (
          <div className="space-y-4">
            {queues.map((queueData) =>
              queueData.jobs.map((job) => (
                <div key={`${job.queue}-${job.id}`} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium">{job.name}</span>
                        {getStatusBadge(job.status)}
                        <Badge variant="outline">{job.queue}</Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        ID: {job.id} • Attempts: {job.attemptsMade}
                        {job.delay && ` • Delayed: ${job.delay}ms`}
                        {job.progress && ` • Progress: ${job.progress}%`}
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      {job.status === 'failed' && (
                        <Button
                          onClick={() => retryJob(job.id, job.queue)}
                          variant="outline"
                          size="sm"
                          title="Retry Job"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      {job.status === 'delayed' && (
                        <Button
                          onClick={() => promoteJob(job.id, job.queue)}
                          variant="outline"
                          size="sm"
                          title="Promote Job"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        onClick={() => removeJob(job.id, job.queue)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        title="Remove Job"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Created:</span> {formatTimestamp(job.timestamp)}
                    </div>
                    {job.processedOn && (
                      <div>
                        <span className="font-medium">Processed:</span> {formatTimestamp(job.processedOn)}
                      </div>
                    )}
                    {job.finishedOn && (
                      <div>
                        <span className="font-medium">Finished:</span> {formatTimestamp(job.finishedOn)}
                      </div>
                    )}
                  </div>

                  {job.failedReason && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
                      <span className="font-medium text-red-800">Error:</span>
                      <div className="text-red-700 mt-1">{job.failedReason}</div>
                    </div>
                  )}

                  {job.data && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700">Job Data</summary>
                      <pre className="mt-2 p-2 bg-gray-50 border rounded text-xs overflow-auto">
                        {JSON.stringify(job.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </Card>
    </div>
  );
}