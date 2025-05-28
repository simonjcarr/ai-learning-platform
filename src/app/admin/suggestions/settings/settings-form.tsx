'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

interface SettingsFormProps {
  initialSettings: {
    settingsId: string;
    rateLimitMinutes: number;
    maxSuggestionsPerUser: number;
    badgeThresholds: {
      bronze?: number;
      silver?: number;
      gold?: number;
    };
  } | null;
}

export default function SuggestionSettingsForm({ initialSettings }: SettingsFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    rateLimitMinutes: initialSettings?.rateLimitMinutes || 60,
    maxSuggestionsPerUser: initialSettings?.maxSuggestionsPerUser || 10,
    bronzeThreshold: initialSettings?.badgeThresholds?.bronze || 5,
    silverThreshold: initialSettings?.badgeThresholds?.silver || 10,
    goldThreshold: initialSettings?.badgeThresholds?.gold || 25,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/suggestions/settings', {
        method: initialSettings ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rateLimitMinutes: formData.rateLimitMinutes,
          maxSuggestionsPerUser: formData.maxSuggestionsPerUser,
          badgeThresholds: {
            bronze: formData.bronzeThreshold,
            silver: formData.silverThreshold,
            gold: formData.goldThreshold,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      router.refresh();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Rate Limiting</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="rate-limit" className="text-gray-700">
              Rate Limit (minutes)
            </Label>
            <Input
              id="rate-limit"
              type="number"
              min="1"
              value={formData.rateLimitMinutes}
              onChange={(e) => setFormData({ ...formData, rateLimitMinutes: parseInt(e.target.value) })}
              className="mt-1"
              placeholder="60"
            />
            <p className="text-sm text-gray-500 mt-1">
              Time in minutes before a user can suggest to the same article again
            </p>
          </div>

          <div>
            <Label htmlFor="max-suggestions" className="text-gray-700">
              Max Suggestions per User
            </Label>
            <Input
              id="max-suggestions"
              type="number"
              min="1"
              value={formData.maxSuggestionsPerUser}
              onChange={(e) => setFormData({ ...formData, maxSuggestionsPerUser: parseInt(e.target.value) })}
              className="mt-1"
              placeholder="10"
            />
            <p className="text-sm text-gray-500 mt-1">
              Maximum total suggestions a user can make
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Badge Thresholds</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="bronze" className="text-gray-700">
              Bronze Badge
            </Label>
            <Input
              id="bronze"
              type="number"
              min="1"
              value={formData.bronzeThreshold}
              onChange={(e) => setFormData({ ...formData, bronzeThreshold: parseInt(e.target.value) })}
              className="mt-1"
              placeholder="5"
            />
            <p className="text-sm text-gray-500 mt-1">
              Approved suggestions needed
            </p>
          </div>

          <div>
            <Label htmlFor="silver" className="text-gray-700">
              Silver Badge
            </Label>
            <Input
              id="silver"
              type="number"
              min="1"
              value={formData.silverThreshold}
              onChange={(e) => setFormData({ ...formData, silverThreshold: parseInt(e.target.value) })}
              className="mt-1"
              placeholder="10"
            />
            <p className="text-sm text-gray-500 mt-1">
              Approved suggestions needed
            </p>
          </div>

          <div>
            <Label htmlFor="gold" className="text-gray-700">
              Gold Badge
            </Label>
            <Input
              id="gold"
              type="number"
              min="1"
              value={formData.goldThreshold}
              onChange={(e) => setFormData({ ...formData, goldThreshold: parseInt(e.target.value) })}
              className="mt-1"
              placeholder="25"
            />
            <p className="text-sm text-gray-500 mt-1">
              Approved suggestions needed
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-orange-600 text-white hover:bg-orange-700"
        >
          {isSubmitting ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </form>
  );
}