'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Role } from '@prisma/client';

interface Tag {
  tagId: string;
  tagName: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    articles: number;
  };
}

export default function AdminTagsPage() {
  const router = useRouter();
  const { hasMinRole, isLoadingRole } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState({
    tagName: '',
    description: '',
    color: ''
  });

  const fetchTags = async () => {
    try {
      const searchParam = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
      const response = await fetch(`/api/admin/tags${searchParam}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }
      
      const data = await response.json();
      setTags(data);
    } catch (error) {
      console.error('Error fetching tags:', error);
      setError('Failed to fetch tags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [searchTerm]);

  useEffect(() => {
    if (!isLoadingRole && !hasMinRole(Role.ADMIN)) {
      router.push('/dashboard');
    }
  }, [isLoadingRole, hasMinRole, router]);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create tag');
      }

      await fetchTags();
      setShowCreateForm(false);
      setFormData({ tagName: '', description: '', color: '' });
    } catch (error) {
      console.error('Error creating tag:', error);
      setError(error instanceof Error ? error.message : 'Failed to create tag');
    }
  };

  const handleUpdateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag) return;
    
    setError(null);

    try {
      const response = await fetch(`/api/admin/tags/${editingTag.tagId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update tag');
      }

      await fetchTags();
      setEditingTag(null);
      setFormData({ tagName: '', description: '', color: '' });
    } catch (error) {
      console.error('Error updating tag:', error);
      setError(error instanceof Error ? error.message : 'Failed to update tag');
    }
  };

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    if (!confirm(`Are you sure you want to delete the tag "${tagName}"? This will remove it from all articles.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tags/${tagId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete tag');
      }

      await fetchTags();
    } catch (error) {
      console.error('Error deleting tag:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete tag');
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({
      tagName: tag.tagName,
      description: tag.description || '',
      color: tag.color || ''
    });
    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setShowCreateForm(false);
    setFormData({ tagName: '', description: '', color: '' });
  };

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!hasMinRole(Role.ADMIN)) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Tag Management</h1>
        <button
          onClick={() => {
            setShowCreateForm(true);
            setEditingTag(null);
            setFormData({ tagName: '', description: '', color: '' });
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
        >
          Create New Tag
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingTag) && (
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingTag ? 'Edit Tag' : 'Create New Tag'}
          </h2>
          <form onSubmit={editingTag ? handleUpdateTag : handleCreateTag} className="space-y-4">
            <div>
              <label htmlFor="tagName" className="block text-sm font-medium text-gray-700 mb-1">
                Tag Name *
              </label>
              <input
                type="text"
                id="tagName"
                value={formData.tagName}
                onChange={(e) => setFormData({ ...formData, tagName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
            <div>
              <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-1">
                Color (Hex)
              </label>
              <input
                type="color"
                id="color"
                value={formData.color || '#3B82F6'}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-20 h-10 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                {editingTag ? 'Update Tag' : 'Create Tag'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tags List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="text-lg">Loading tags...</div>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tag
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Articles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tags.map((tag) => (
                <tr key={tag.tagId}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {tag.color && (
                        <div
                          className="w-4 h-4 rounded-full mr-3"
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                      <div className="text-sm font-medium text-gray-900">{tag.tagName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {tag.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{tag._count.articles}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(tag.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => startEdit(tag)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag.tagId, tag.tagName)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {tags.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No tags found matching your search.' : 'No tags created yet.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}