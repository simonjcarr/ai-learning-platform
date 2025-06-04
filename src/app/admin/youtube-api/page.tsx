"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Youtube, Edit, Plus, Trash2, Eye, EyeOff, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface YouTubeAPIModel {
  modelId: string;
  modelName: string;
  provider: string;
  displayName: string;
  description?: string;
  maxResults: number;
  searchFilters?: any;
  isActive: boolean;
  quotaLimit: number;
  quotaUsed: number;
  quotaResetAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ModelFormData {
  modelName: string;
  displayName: string;
  description: string;
  apiKey: string;
  maxResults: string;
  quotaLimit: string;
  searchFilters: string;
}

const initialFormData: ModelFormData = {
  modelName: 'youtube_data_api_v3',
  displayName: 'YouTube Data API v3',
  description: 'YouTube Data API for video search integration',
  apiKey: '',
  maxResults: '5',
  quotaLimit: '10000',
  searchFilters: '{}',
};

export default function YouTubeAPIPage() {
  const [models, setModels] = useState<YouTubeAPIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<YouTubeAPIModel | null>(null);
  const [formData, setFormData] = useState<ModelFormData>(initialFormData);
  const [showApiKey, setShowApiKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/admin/youtube-api');
      if (response.ok) {
        const data = await response.json();
        setModels(data);
      } else {
        toast.error('Failed to fetch YouTube API models');
      }
    } catch {
      toast.error('Error fetching YouTube API models');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = editingModel 
        ? `/api/admin/youtube-api/${editingModel.modelId}`
        : '/api/admin/youtube-api';
      
      const method = editingModel ? 'PUT' : 'POST';
      
      let searchFilters;
      try {
        searchFilters = JSON.parse(formData.searchFilters);
      } catch {
        toast.error('Invalid JSON in search filters');
        setSubmitting(false);
        return;
      }

      const payload: {
        modelName: string;
        displayName: string;
        description: string;
        apiKey?: string;
        maxResults: number;
        quotaLimit: number;
        searchFilters: any;
      } = {
        ...formData,
        maxResults: parseInt(formData.maxResults),
        quotaLimit: parseInt(formData.quotaLimit),
        searchFilters,
      };

      // Only include API key if it's provided (for updates, empty means no change)
      if (!editingModel || formData.apiKey.trim()) {
        payload.apiKey = formData.apiKey;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingModel ? 'YouTube API model updated successfully' : 'YouTube API model created successfully');
        setIsCreateOpen(false);
        setEditingModel(null);
        setFormData(initialFormData);
        fetchModels();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to save YouTube API model');
      }
    } catch {
      toast.error('Error saving YouTube API model');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (model: YouTubeAPIModel) => {
    setEditingModel(model);
    setFormData({
      modelName: model.modelName,
      displayName: model.displayName,
      description: model.description || '',
      apiKey: '', // Don't show existing API key
      maxResults: model.maxResults.toString(),
      quotaLimit: model.quotaLimit.toString(),
      searchFilters: JSON.stringify(model.searchFilters || {}, null, 2),
    });
    setIsCreateOpen(true);
  };

  const handleDelete = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this YouTube API model?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/youtube-api/${modelId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('YouTube API model deleted successfully');
        fetchModels();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete YouTube API model');
      }
    } catch {
      toast.error('Error deleting YouTube API model');
    }
  };

  const toggleModelStatus = async (modelId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/youtube-api/${modelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        toast.success(`YouTube API model ${!isActive ? 'activated' : 'deactivated'} successfully`);
        fetchModels();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update YouTube API model status');
      }
    } catch {
      toast.error('Error updating YouTube API model status');
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingModel(null);
    setShowApiKey(false);
  };

  const formatQuotaPercentage = (used: number, limit: number) => {
    return Math.round((used / limit) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">YouTube API Models</h1>
          <p className="text-gray-600">Manage YouTube Data API configurations for video search</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add YouTube API
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingModel ? 'Edit YouTube API Model' : 'Add New YouTube API Model'}</DialogTitle>
              <DialogDescription>
                {editingModel ? 'Update the YouTube API configuration' : 'Configure a new YouTube Data API for video search'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="modelName">Model Name</Label>
                  <Input
                    id="modelName"
                    value={formData.modelName}
                    onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                    placeholder="youtube_data_api_v3"
                    required
                    disabled={editingModel !== null}
                  />
                </div>
                <div>
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="YouTube Data API v3"
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
                  placeholder="Description of this API configuration"
                />
              </div>

              <div>
                <Label htmlFor="apiKey">YouTube Data API Key</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder={editingModel ? "Leave empty to keep current key" : "Enter YouTube Data API key"}
                    required={!editingModel}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxResults">Max Results per Search</Label>
                  <Input
                    id="maxResults"
                    type="number"
                    min="1"
                    max="50"
                    value={formData.maxResults}
                    onChange={(e) => setFormData({ ...formData, maxResults: e.target.value })}
                    placeholder="5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="quotaLimit">Daily Quota Limit</Label>
                  <Input
                    id="quotaLimit"
                    type="number"
                    min="100"
                    value={formData.quotaLimit}
                    onChange={(e) => setFormData({ ...formData, quotaLimit: e.target.value })}
                    placeholder="10000"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="searchFilters">Search Filters (JSON)</Label>
                <Textarea
                  id="searchFilters"
                  value={formData.searchFilters}
                  onChange={(e) => setFormData({ ...formData, searchFilters: e.target.value })}
                  placeholder='{"duration": "medium", "categoryId": "27"}'
                  rows={4}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Optional JSON object with additional search parameters (duration, categoryId, etc.)
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingModel ? 'Update Model' : 'Create Model'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {models.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <div className="text-center">
                <Youtube className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No YouTube API models configured yet</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          models.map((model) => (
            <Card key={model.modelId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Youtube className="h-5 w-5 text-red-600" />
                      {model.displayName}
                      {!model.isActive && <Badge variant="destructive">Inactive</Badge>}
                    </CardTitle>
                    <CardDescription>
                      {model.provider} • {model.modelName}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleModelStatus(model.modelId, model.isActive)}
                    >
                      {model.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(model)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(model.modelId)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {model.description && (
                  <p className="text-gray-600 mb-4">{model.description}</p>
                )}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">Max Results:</span>
                    <div className="text-blue-600">
                      {model.maxResults} videos per search
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Quota Usage:</span>
                    <div className="flex items-center text-orange-600">
                      <BarChart3 className="h-3 w-3 mr-1" />
                      {model.quotaUsed} / {model.quotaLimit} ({formatQuotaPercentage(model.quotaUsed, model.quotaLimit)}%)
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Quota Reset:</span>
                    <div className="text-gray-600">
                      {model.quotaResetAt ? new Date(model.quotaResetAt).toLocaleDateString() : 'Never'}
                    </div>
                  </div>
                </div>
                {model.searchFilters && Object.keys(model.searchFilters).length > 0 && (
                  <div className="mt-4">
                    <span className="font-medium text-gray-900">Search Filters:</span>
                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(model.searchFilters, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}