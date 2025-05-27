"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Brain, DollarSign, Edit, Plus, Settings, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface AIModel {
  modelId: string;
  displayName: string;
  provider: string;
  isActive: boolean;
}

interface AIInteractionType {
  typeId: string;
  typeName: string;
  displayName: string;
  description?: string;
  defaultModelId?: string;
  defaultModel?: AIModel;
  createdAt: string;
  updatedAt: string;
}

interface TypeFormData {
  typeName: string;
  displayName: string;
  description: string;
  defaultModelId: string;
}

const initialFormData: TypeFormData = {
  typeName: '',
  displayName: '',
  description: '',
  defaultModelId: '',
};

export default function AIInteractionsPage() {
  const [interactionTypes, setInteractionTypes] = useState<AIInteractionType[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingType, setEditingType] = useState<AIInteractionType | null>(null);
  const [formData, setFormData] = useState<TypeFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [typesResponse, modelsResponse] = await Promise.all([
        fetch('/api/admin/ai-interaction-types'),
        fetch('/api/admin/ai-models')
      ]);

      if (typesResponse.ok && modelsResponse.ok) {
        const [typesData, modelsData] = await Promise.all([
          typesResponse.json(),
          modelsResponse.json()
        ]);
        setInteractionTypes(typesData);
        setModels(modelsData.filter((m: AIModel) => m.isActive));
      } else {
        toast.error('Failed to fetch data');
      }
    } catch (error) {
      toast.error('Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = editingType 
        ? `/api/admin/ai-interaction-types/${editingType.typeId}`
        : '/api/admin/ai-interaction-types';
      
      const method = editingType ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        defaultModelId: formData.defaultModelId === 'none' ? null : formData.defaultModelId || null,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingType ? 'Interaction type updated successfully' : 'Interaction type created successfully');
        setIsCreateOpen(false);
        setEditingType(null);
        setFormData(initialFormData);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save interaction type');
      }
    } catch (error) {
      toast.error('Error saving interaction type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (type: AIInteractionType) => {
    setEditingType(type);
    setFormData({
      typeName: type.typeName,
      displayName: type.displayName,
      description: type.description || '',
      defaultModelId: type.defaultModelId || '',
    });
    setIsCreateOpen(true);
  };

  const handleDelete = async (typeId: string) => {
    if (!confirm('Are you sure you want to delete this interaction type?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/ai-interaction-types/${typeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Interaction type deleted successfully');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete interaction type');
      }
    } catch (error) {
      toast.error('Error deleting interaction type');
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingType(null);
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
          <h1 className="text-2xl font-bold text-gray-900">AI Interaction Types</h1>
          <p className="text-gray-600">Configure AI models for different types of interactions</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Interaction Type
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingType ? 'Edit Interaction Type' : 'Add New Interaction Type'}</DialogTitle>
              <DialogDescription>
                {editingType ? 'Update the interaction type configuration' : 'Configure a new type of AI interaction'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="typeName">Type Name (Internal)</Label>
                <Input
                  id="typeName"
                  value={formData.typeName}
                  onChange={(e) => setFormData({ ...formData, typeName: e.target.value })}
                  placeholder="article_generation"
                  required
                  disabled={editingType !== null}
                  pattern="[a-z_]+"
                  title="Use lowercase letters and underscores only"
                />
                <p className="text-xs text-gray-500 mt-1">Used internally by the system</p>
              </div>

              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="Article Generation"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Generate full article content using AI"
                />
              </div>

              <div>
                <Label htmlFor="defaultModel">Default AI Model</Label>
                <Select 
                  value={formData.defaultModelId} 
                  onValueChange={(value) => setFormData({ ...formData, defaultModelId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select default model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No default model</SelectItem>
                    {models.map((model) => (
                      <SelectItem key={model.modelId} value={model.modelId}>
                        {model.displayName} ({model.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Model to use for this type of interaction</p>
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
                  {submitting ? 'Saving...' : editingType ? 'Update Type' : 'Create Type'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {interactionTypes.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <div className="text-center">
                <Zap className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No interaction types configured yet</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          interactionTypes.map((type) => (
            <Card key={type.typeId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      {type.displayName}
                    </CardTitle>
                    <CardDescription>
                      {type.typeName}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(type)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(type.typeId)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {type.description && (
                  <p className="text-gray-600 mb-4">{type.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">Default Model:</span>
                    {type.defaultModel ? (
                      <Badge variant="secondary" className="ml-2">
                        <Brain className="h-3 w-3 mr-1" />
                        {type.defaultModel.displayName}
                      </Badge>
                    ) : (
                      <span className="text-gray-500 ml-2">No default model</span>
                    )}
                  </div>
                  {!type.defaultModel?.isActive && type.defaultModel && (
                    <div className="flex items-center text-amber-600">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span className="text-sm">Default model is inactive</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {models.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center justify-center p-6">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-amber-600 mx-auto mb-2" />
              <p className="text-amber-800 font-medium">No active AI models available</p>
              <p className="text-amber-700 text-sm">Add and activate AI models before configuring interaction types.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}