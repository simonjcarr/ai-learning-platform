"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Brain, DollarSign, Edit, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface AIModel {
  modelId: string;
  modelName: string;
  provider: string;
  displayName: string;
  description?: string;
  inputTokenCostPer1M: number;
  outputTokenCostPer1M: number;
  maxTokens?: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ModelFormData {
  modelName: string;
  provider: string;
  displayName: string;
  description: string;
  apiKey: string;
  inputTokenCostPer1M: string;
  outputTokenCostPer1M: string;
  maxTokens: string;
  isDefault: boolean;
}

const initialFormData: ModelFormData = {
  modelName: '',
  provider: 'openai',
  displayName: '',
  description: '',
  apiKey: '',
  inputTokenCostPer1M: '',
  outputTokenCostPer1M: '',
  maxTokens: '',
  isDefault: false,
};

export default function AIModelsPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [formData, setFormData] = useState<ModelFormData>(initialFormData);
  const [showApiKey, setShowApiKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/admin/ai-models');
      if (response.ok) {
        const data = await response.json();
        setModels(data);
      } else {
        toast.error('Failed to fetch AI models');
      }
    } catch (error) {
      toast.error('Error fetching AI models');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = editingModel 
        ? `/api/admin/ai-models/${editingModel.modelId}`
        : '/api/admin/ai-models';
      
      const method = editingModel ? 'PUT' : 'POST';
      
      const payload: any = {
        ...formData,
        inputTokenCostPer1M: parseFloat(formData.inputTokenCostPer1M),
        outputTokenCostPer1M: parseFloat(formData.outputTokenCostPer1M),
        maxTokens: formData.maxTokens ? parseInt(formData.maxTokens) : null,
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
        toast.success(editingModel ? 'Model updated successfully' : 'Model created successfully');
        setIsCreateOpen(false);
        setEditingModel(null);
        setFormData(initialFormData);
        fetchModels();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save model');
      }
    } catch (error) {
      toast.error('Error saving model');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (model: AIModel) => {
    setEditingModel(model);
    setFormData({
      modelName: model.modelName,
      provider: model.provider,
      displayName: model.displayName,
      description: model.description || '',
      apiKey: '', // Don't show existing API key
      inputTokenCostPer1M: model.inputTokenCostPer1M.toString(),
      outputTokenCostPer1M: model.outputTokenCostPer1M.toString(),
      maxTokens: model.maxTokens?.toString() || '',
      isDefault: model.isDefault,
    });
    setIsCreateOpen(true);
  };

  const handleDelete = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this model?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/ai-models/${modelId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Model deleted successfully');
        fetchModels();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete model');
      }
    } catch (error) {
      toast.error('Error deleting model');
    }
  };

  const toggleModelStatus = async (modelId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/ai-models/${modelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        toast.success(`Model ${!isActive ? 'activated' : 'deactivated'} successfully`);
        fetchModels();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update model status');
      }
    } catch (error) {
      toast.error('Error updating model status');
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingModel(null);
    setShowApiKey(false);
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
          <h1 className="text-2xl font-bold text-gray-900">AI Models</h1>
          <p className="text-gray-600">Manage AI models and their configurations</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Model
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingModel ? 'Edit Model' : 'Add New Model'}</DialogTitle>
              <DialogDescription>
                {editingModel ? 'Update the AI model configuration' : 'Configure a new AI model for the platform'}
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
                    placeholder="gpt-4-0125-preview"
                    required
                    disabled={editingModel !== null}
                  />
                </div>
                <div>
                  <Label htmlFor="provider">Provider</Label>
                  <Select 
                    value={formData.provider} 
                    onValueChange={(value) => setFormData({ ...formData, provider: value })}
                    disabled={editingModel !== null}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="GPT-4 Turbo"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description of this model's capabilities"
                />
              </div>

              <div>
                <Label htmlFor="apiKey">API Key</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder={editingModel ? "Leave empty to keep current key" : "Enter API key"}
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

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="inputCost">Input Cost (per 1M tokens)</Label>
                  <Input
                    id="inputCost"
                    type="number"
                    step="0.000001"
                    value={formData.inputTokenCostPer1M}
                    onChange={(e) => setFormData({ ...formData, inputTokenCostPer1M: e.target.value })}
                    placeholder="10.0"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="outputCost">Output Cost (per 1M tokens)</Label>
                  <Input
                    id="outputCost"
                    type="number"
                    step="0.000001"
                    value={formData.outputTokenCostPer1M}
                    onChange={(e) => setFormData({ ...formData, outputTokenCostPer1M: e.target.value })}
                    placeholder="30.0"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="maxTokens">Max Tokens (optional)</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    value={formData.maxTokens}
                    onChange={(e) => setFormData({ ...formData, maxTokens: e.target.value })}
                    placeholder="4096"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                />
                <Label htmlFor="isDefault">Set as default model</Label>
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
                <Brain className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No AI models configured yet</p>
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
                      <Brain className="h-5 w-5" />
                      {model.displayName}
                      {model.isDefault && <Badge variant="secondary">Default</Badge>}
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
                    <span className="font-medium text-gray-900">Input Cost:</span>
                    <div className="flex items-center text-green-600">
                      <DollarSign className="h-3 w-3 mr-1" />
                      {model.inputTokenCostPer1M}/1M tokens
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Output Cost:</span>
                    <div className="flex items-center text-green-600">
                      <DollarSign className="h-3 w-3 mr-1" />
                      {model.outputTokenCostPer1M}/1M tokens
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Max Tokens:</span>
                    <div className="text-gray-600">
                      {model.maxTokens ? model.maxTokens.toLocaleString() : 'Unlimited'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}