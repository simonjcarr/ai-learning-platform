'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

type TimePeriod = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';

interface ModelData {
  modelId: string;
  modelName: string;
  provider: string;
  interactions: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

interface InteractionTypeData {
  typeId: string;
  typeName: string;
  displayName: string;
  interactions: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

interface UserData {
  userId: string;
  email: string;
  displayName: string;
  interactions: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

interface TotalsData {
  totalInteractions: number;
  successfulInteractions: number;
  failedInteractions: number;
  successRate: string;
  uniqueUsers: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalInputCost: number;
  totalOutputCost: number;
  totalCost: number;
  averageResponseTime: number;
  averageCostPerInteraction: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AIReportsPage() {
  const [period, setPeriod] = useState<TimePeriod>('day');
  const [modelData, setModelData] = useState<ModelData[]>([]);
  const [interactionData, setInteractionData] = useState<InteractionTypeData[]>([]);
  const [userData, setUserData] = useState<UserData[]>([]);
  const [totalsData, setTotalsData] = useState<TotalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [dataUpdated, setDataUpdated] = useState(false);

  // Auto-refresh with polling instead of SSE
  const [isPolling, setIsPolling] = useState(true);
  const [connectionState, setConnectionState] = useState<'connected' | 'connecting' | 'disconnected'>('connected');
  
  // Polling interval
  useEffect(() => {
    if (!isPolling) return;
    
    const pollData = async () => {
      try {
        const [modelsRes, interactionsRes, usersRes, totalsRes] = await Promise.all([
          fetch(`/api/admin/ai-reports/by-model?period=${period}`),
          fetch(`/api/admin/ai-reports/by-interaction?period=${period}`),
          fetch(`/api/admin/ai-reports/by-user?period=${period}`),
          fetch(`/api/admin/ai-reports/totals?period=${period}`)
        ]);

        if (modelsRes.ok) {
          const data = await modelsRes.json();
          setModelData(data.data);
        }

        if (interactionsRes.ok) {
          const data = await interactionsRes.json();
          setInteractionData(data.data);
        }

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUserData(data.data);
        }

        if (totalsRes.ok) {
          const data = await totalsRes.json();
          setTotalsData(data.data);
        }

        setLastUpdate(new Date());
        setConnectionState('connected');
        
        // Trigger update flash effect
        setDataUpdated(true);
        setTimeout(() => setDataUpdated(false), 500);
      } catch (error) {
        console.error('Error polling AI reports:', error);
        setConnectionState('disconnected');
      }
    };

    // Poll every 5 seconds
    const interval = setInterval(pollData, 5000);
    
    return () => clearInterval(interval);
  }, [period, isPolling]);
  
  const reconnect = () => {
    setConnectionState('connecting');
    setIsPolling(true);
  };

  // Pause polling when page is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPolling(false);
      } else {
        setIsPolling(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const fetchInitialData = async () => {
    try {
      const [modelsRes, interactionsRes, usersRes, totalsRes] = await Promise.all([
        fetch(`/api/admin/ai-reports/by-model?period=${period}`),
        fetch(`/api/admin/ai-reports/by-interaction?period=${period}`),
        fetch(`/api/admin/ai-reports/by-user?period=${period}`),
        fetch(`/api/admin/ai-reports/totals?period=${period}`)
      ]);

      if (modelsRes.ok) {
        const data = await modelsRes.json();
        setModelData(data.data);
      }

      if (interactionsRes.ok) {
        const data = await interactionsRes.json();
        setInteractionData(data.data);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUserData(data.data);
      }

      if (totalsRes.ok) {
        const data = await totalsRes.json();
        setTotalsData(data.data);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching AI reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading AI reports...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <style jsx>{`
        @keyframes flash {
          0% { background-color: transparent; }
          50% { background-color: rgba(59, 130, 246, 0.1); }
          100% { background-color: transparent; }
        }
        .update-flash {
          animation: flash 0.5s ease-in-out;
        }
      `}</style>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">AI Usage Reports</h1>
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  isPolling ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <span className="text-sm text-gray-600">
                  {isPolling ? 'Auto-refresh: ON' : 'Auto-refresh: OFF'}
                </span>
              </div>
              
              {/* Last Update Time */}
              {lastUpdate && (
                <span className="text-sm text-gray-500">
                  Last update: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
              
              {/* Pause/Play Button */}
              <button
                onClick={() => setIsPolling(!isPolling)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {isPolling ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>
          
          {/* Time Period Selector */}
          <div className="flex space-x-2">
            {(['hour', 'day', 'week', 'month', 'year', 'all'] as TimePeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {p === 'all' ? 'All Time' : p}
              </button>
            ))}
          </div>
        </div>

        {/* Total Stats */}
        {totalsData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className={`bg-white rounded-lg shadow p-6 transition-all ${dataUpdated ? 'update-flash' : ''}`}>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Interactions</h3>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(totalsData.totalInteractions)}</p>
              <p className="text-sm text-gray-600 mt-1">
                {totalsData.successRate}% success rate
              </p>
            </div>
            <div className={`bg-white rounded-lg shadow p-6 transition-all ${dataUpdated ? 'update-flash' : ''}`}>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Tokens</h3>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(totalsData.totalTokens)}</p>
              <p className="text-sm text-gray-600 mt-1">
                {formatNumber(totalsData.totalInputTokens)} input / {formatNumber(totalsData.totalOutputTokens)} output
              </p>
            </div>
            <div className={`bg-white rounded-lg shadow p-6 transition-all ${dataUpdated ? 'update-flash' : ''}`}>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Cost</h3>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalsData.totalCost)}</p>
              <p className="text-sm text-gray-600 mt-1">
                {formatCurrency(totalsData.averageCostPerInteraction)} per interaction
              </p>
            </div>
            <div className={`bg-white rounded-lg shadow p-6 transition-all ${dataUpdated ? 'update-flash' : ''}`}>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Performance</h3>
              <p className="text-2xl font-bold text-gray-900">{totalsData.averageResponseTime}ms</p>
              <p className="text-sm text-gray-600 mt-1">
                Avg response time
              </p>
            </div>
          </div>
        )}

        {/* Usage by Model */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Usage by AI Model</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Model Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={modelData}
                    dataKey="totalCost"
                    nameKey="modelName"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.modelName}: ${formatCurrency(entry.totalCost)}`}
                  >
                    {modelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Model Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Model
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Interactions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tokens
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {modelData.map((model) => (
                    <tr key={model.modelId}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{model.modelName}</div>
                          <div className="text-sm text-gray-500">{model.provider}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(model.interactions)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(model.totalTokens)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(model.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Usage by Interaction Type */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Usage by Interaction Type</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Interaction Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Token Usage</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={interactionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="displayName" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                  <Legend />
                  <Bar dataKey="inputTokens" fill="#3b82f6" name="Input Tokens" />
                  <Bar dataKey="outputTokens" fill="#10b981" name="Output Tokens" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Interaction Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Interactions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tokens
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {interactionData.map((interaction) => (
                    <tr key={interaction.typeId}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{interaction.displayName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(interaction.interactions)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(interaction.totalTokens)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(interaction.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Top Users */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Top Users by Usage</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Interactions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tokens
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {userData.slice(0, 10).map((user) => (
                  <tr key={user.userId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.displayName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatNumber(user.interactions)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatNumber(user.totalTokens)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(user.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}