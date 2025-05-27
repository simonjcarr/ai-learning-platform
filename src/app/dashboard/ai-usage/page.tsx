"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { 
  Brain, DollarSign, TrendingUp, Zap, Users, CheckCircle, XCircle, 
  Calendar, Clock, Activity, ChevronDown
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Role } from '@prisma/client';
import { toast } from 'sonner';

interface AIUsageData {
  summary: {
    totalCost: string;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalInteractions: number;
    successfulInteractions: number;
    failedInteractions: number;
    successRate: string;
  };
  charts: {
    daily: Array<{
      date: string;
      cost: number;
      interactions: number;
      inputTokens: number;
      outputTokens: number;
    }>;
    models: Array<{
      model: string;
      cost: number;
      interactions: number;
      inputTokens: number;
      outputTokens: number;
    }>;
    types: Array<{
      type: string;
      cost: number;
      interactions: number;
      inputTokens: number;
      outputTokens: number;
    }>;
    users: Array<{
      userId: string;
      name: string;
      cost: number;
      interactions: number;
      inputTokens: number;
      outputTokens: number;
    }>;
  };
  recentInteractions: Array<{
    id: string;
    model: string;
    type: string;
    cost: string;
    inputTokens: number;
    outputTokens: number;
    duration: number;
    isSuccessful: boolean;
    startedAt: string;
    user?: {
      name: string;
      email: string;
    };
  }>;
}

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];

export default function AIUsagePage() {
  const { hasMinRole } = useAuth();
  const [data, setData] = useState<AIUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/dashboard/ai-usage?days=${timeRange}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        toast.error('Failed to fetch AI usage data');
      }
    } catch (error) {
      toast.error('Error fetching AI usage data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 6
    }).format(amount);
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Failed to load AI usage data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Usage Analytics</h1>
          <p className="text-gray-600">Track AI model usage, costs, and performance</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(parseFloat(data.summary.totalCost))}</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.totalInteractions} interactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Input Tokens</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(data.summary.totalInputTokens)}</div>
            <p className="text-xs text-muted-foreground">
              Tokens sent to AI
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Output Tokens</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(data.summary.totalOutputTokens)}</div>
            <p className="text-xs text-muted-foreground">
              Tokens generated by AI
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.successfulInteractions} successful
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Usage Trend</CardTitle>
            <CardDescription>Cost and interactions over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.charts.daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                />
                <YAxis yAxisId="cost" orientation="left" />
                <YAxis yAxisId="interactions" orientation="right" />
                <Tooltip 
                  labelFormatter={(value) => formatDate(value as string)}
                  formatter={(value, name) => [
                    name === 'cost' ? formatCurrency(value as number) : value,
                    name === 'cost' ? 'Cost' : 'Interactions'
                  ]}
                />
                <Legend />
                <Line 
                  yAxisId="cost"
                  type="monotone" 
                  dataKey="cost" 
                  stroke="#f97316" 
                  strokeWidth={2}
                  name="Cost ($)"
                />
                <Line 
                  yAxisId="interactions"
                  type="monotone" 
                  dataKey="interactions" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Interactions"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Model Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Usage by Model</CardTitle>
            <CardDescription>Cost distribution across AI models</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.charts.models}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ model, cost }) => `${model}: ${formatCurrency(cost)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="cost"
                >
                  {data.charts.models.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Interaction Types */}
        <Card>
          <CardHeader>
            <CardTitle>Usage by Interaction Type</CardTitle>
            <CardDescription>Cost breakdown by functionality</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.charts.types}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="cost" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Usage (Admin only) */}
        {hasMinRole(Role.ADMIN) && data.charts.users.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Usage by User</CardTitle>
              <CardDescription>Cost breakdown by user</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.charts.users}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Bar dataKey="cost" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Interactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Interactions</CardTitle>
          <CardDescription>Latest AI interactions and their details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.recentInteractions.map((interaction) => (
              <div key={interaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {interaction.isSuccessful ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <div className="font-medium">{interaction.model}</div>
                      <div className="text-sm text-gray-500">{interaction.type}</div>
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="flex items-center space-x-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>{formatTokens(interaction.inputTokens)} in</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Brain className="h-3 w-3" />
                      <span>{formatTokens(interaction.outputTokens)} out</span>
                    </div>
                  </div>
                  {hasMinRole(Role.ADMIN) && interaction.user && (
                    <div className="text-sm text-gray-500">
                      {interaction.user.name}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatCurrency(parseFloat(interaction.cost))}</div>
                  <div className="text-sm text-gray-500">
                    {interaction.duration ? `${interaction.duration}ms` : 'N/A'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(interaction.startedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}