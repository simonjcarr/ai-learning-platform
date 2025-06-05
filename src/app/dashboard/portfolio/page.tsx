'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PlusIcon, XIcon, ExternalLinkIcon, SaveIcon, EyeIcon } from 'lucide-react';
import Link from 'next/link';

interface Portfolio {
  portfolioId: string;
  slug: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  isPublic: boolean;
  isAvailableForWork: boolean;
  jobTypes: string[];
  skills: string[];
  preferredJobTitles: string[];
  salaryRange: string | null;
  availabilityDate: string | null;
}

interface Certificate {
  certificateId: string;
  issuedAt: string;
  grade: 'BRONZE' | 'SILVER' | 'GOLD' | null;
  finalScore: number | null;
  certificateData: any;
  course: {
    title: string;
    level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    description: string;
  };
}

const JOB_TYPE_OPTIONS = [
  'Full-time',
  'Part-time',
  'Contract',
  'Freelance',
  'Remote',
  'On-site',
  'Hybrid',
  'Internship',
  'Temporary'
];

export default function PortfolioPage() {
  const { user } = useUser();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [availableCertificates, setAvailableCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);

  useEffect(() => {
    fetchPortfolio();
    fetchAvailableCertificates();
  }, []);

  const fetchPortfolio = async () => {
    try {
      const response = await fetch('/api/portfolio');
      if (response.ok) {
        const data = await response.json();
        setPortfolio(data);
        if (data) {
          setSelectedJobTypes(data.jobTypes || []);
        }
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCertificates = async () => {
    try {
      const response = await fetch('/api/certificates/available');
      if (response.ok) {
        const data = await response.json();
        setAvailableCertificates(data);
      }
    } catch (error) {
      console.error('Error fetching certificates:', error);
    }
  };

  const createPortfolio = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const defaultSlug = (user.username || `user-${user.id.slice(-8)}`).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: defaultSlug,
          displayName: user.fullName || '',
          isPublic: false,
          isAvailableForWork: false,
          jobTypes: [],
          skills: [],
          preferredJobTitles: []
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPortfolio(data);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create portfolio');
      }
    } catch (error) {
      console.error('Error creating portfolio:', error);
      alert('Failed to create portfolio');
    } finally {
      setSaving(false);
    }
  };

  const updatePortfolio = async (updates: Partial<Portfolio>) => {
    if (!portfolio) return;

    setSaving(true);
    try {
      const response = await fetch('/api/portfolio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const data = await response.json();
        setPortfolio(data);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update portfolio');
      }
    } catch (error) {
      console.error('Error updating portfolio:', error);
      alert('Failed to update portfolio');
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && portfolio) {
      const updatedSkills = [...portfolio.skills, newSkill.trim()];
      updatePortfolio({ skills: updatedSkills });
      setNewSkill('');
    }
  };

  const removeSkill = (index: number) => {
    if (portfolio) {
      const updatedSkills = portfolio.skills.filter((_, i) => i !== index);
      updatePortfolio({ skills: updatedSkills });
    }
  };

  const addJobTitle = () => {
    if (newJobTitle.trim() && portfolio) {
      const updatedTitles = [...portfolio.preferredJobTitles, newJobTitle.trim()];
      updatePortfolio({ preferredJobTitles: updatedTitles });
      setNewJobTitle('');
    }
  };

  const removeJobTitle = (index: number) => {
    if (portfolio) {
      const updatedTitles = portfolio.preferredJobTitles.filter((_, i) => i !== index);
      updatePortfolio({ preferredJobTitles: updatedTitles });
    }
  };

  const toggleJobType = (jobType: string) => {
    const newJobTypes = selectedJobTypes.includes(jobType)
      ? selectedJobTypes.filter(type => type !== jobType)
      : [...selectedJobTypes, jobType];
    
    setSelectedJobTypes(newJobTypes);
    if (portfolio) {
      updatePortfolio({ jobTypes: newJobTypes });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-gray-600">Loading portfolio...</div>
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Create Your Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-6">
              Create a portfolio to showcase your certificates and skills to potential employers.
            </p>
            <Button onClick={createPortfolio} disabled={saving}>
              {saving ? 'Creating...' : 'Create Portfolio'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Portfolio Settings</h1>
        {portfolio.isPublic && (
          <Link 
            href={`/portfolio/${portfolio.slug}`}
            target="_blank"
            className="flex items-center gap-2 text-orange-600 hover:text-orange-700"
          >
            <EyeIcon className="w-4 h-4" />
            View Public Portfolio
            <ExternalLinkIcon className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="slug">Portfolio URL</Label>
              <div className="flex items-center mt-1">
                <span className="text-sm text-gray-600 mr-1">/portfolio/</span>
                <Input
                  id="slug"
                  value={portfolio.slug}
                  onChange={(e) => {
                    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    setPortfolio({ ...portfolio, slug });
                  }}
                  onBlur={() => updatePortfolio({ slug: portfolio.slug })}
                  placeholder="your-portfolio-url"
                  pattern="[a-z0-9-]+"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Only lowercase letters, numbers, and hyphens allowed</p>
            </div>
            
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={portfolio.displayName || ''}
                onChange={(e) => setPortfolio({ ...portfolio, displayName: e.target.value })}
                onBlur={() => updatePortfolio({ displayName: portfolio.displayName })}
                placeholder="Your display name"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={portfolio.bio || ''}
              onChange={(e) => setPortfolio({ ...portfolio, bio: e.target.value })}
              onBlur={() => updatePortfolio({ bio: portfolio.bio })}
              placeholder="Tell people about yourself..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={portfolio.location || ''}
                onChange={(e) => setPortfolio({ ...portfolio, location: e.target.value })}
                onBlur={() => updatePortfolio({ location: portfolio.location })}
                placeholder="City, Country"
              />
            </div>
            
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={portfolio.website || ''}
                onChange={(e) => setPortfolio({ ...portfolio, website: e.target.value })}
                onBlur={() => updatePortfolio({ website: portfolio.website })}
                placeholder="https://your-website.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
              <Input
                id="linkedinUrl"
                type="url"
                value={portfolio.linkedinUrl || ''}
                onChange={(e) => setPortfolio({ ...portfolio, linkedinUrl: e.target.value })}
                onBlur={() => updatePortfolio({ linkedinUrl: portfolio.linkedinUrl })}
                placeholder="https://linkedin.com/in/yourprofile"
              />
            </div>
            
            <div>
              <Label htmlFor="githubUrl">GitHub URL</Label>
              <Input
                id="githubUrl"
                type="url"
                value={portfolio.githubUrl || ''}
                onChange={(e) => setPortfolio({ ...portfolio, githubUrl: e.target.value })}
                onBlur={() => updatePortfolio({ githubUrl: portfolio.githubUrl })}
                placeholder="https://github.com/yourusername"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isPublic"
              checked={portfolio.isPublic}
              onCheckedChange={(checked) => updatePortfolio({ isPublic: checked })}
            />
            <Label htmlFor="isPublic">Make portfolio public</Label>
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Add a skill (e.g., React, Python, Linux)"
              onKeyPress={(e) => e.key === 'Enter' && addSkill()}
            />
            <Button onClick={addSkill} size="sm">
              <PlusIcon className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {portfolio.skills.map((skill, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                {skill}
                <button 
                  onClick={() => removeSkill(index)}
                  className="ml-1 text-gray-500 hover:text-gray-700"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Job Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Job Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-2">
            <Switch
              id="isAvailableForWork"
              checked={portfolio.isAvailableForWork}
              onCheckedChange={(checked) => updatePortfolio({ isAvailableForWork: checked })}
            />
            <Label htmlFor="isAvailableForWork">Available for work</Label>
          </div>

          {portfolio.isAvailableForWork && (
            <>
              <div>
                <Label>Job Types</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {JOB_TYPE_OPTIONS.map((jobType) => (
                    <Badge
                      key={jobType}
                      variant={selectedJobTypes.includes(jobType) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleJobType(jobType)}
                    >
                      {jobType}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Preferred Job Titles</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newJobTitle}
                    onChange={(e) => setNewJobTitle(e.target.value)}
                    placeholder="Add preferred job title"
                    onKeyPress={(e) => e.key === 'Enter' && addJobTitle()}
                  />
                  <Button onClick={addJobTitle} size="sm">
                    <PlusIcon className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-2">
                  {portfolio.preferredJobTitles.map((title, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {title}
                      <button 
                        onClick={() => removeJobTitle(index)}
                        className="ml-1 text-gray-500 hover:text-gray-700"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="salaryRange">Salary Range</Label>
                  <Input
                    id="salaryRange"
                    value={portfolio.salaryRange || ''}
                    onChange={(e) => setPortfolio({ ...portfolio, salaryRange: e.target.value })}
                    onBlur={() => updatePortfolio({ salaryRange: portfolio.salaryRange })}
                    placeholder="e.g., $80,000 - $120,000"
                  />
                </div>
                
                <div>
                  <Label htmlFor="availabilityDate">Available From</Label>
                  <Input
                    id="availabilityDate"
                    type="date"
                    value={portfolio.availabilityDate ? new Date(portfolio.availabilityDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setPortfolio({ ...portfolio, availabilityDate: e.target.value })}
                    onBlur={() => updatePortfolio({ availabilityDate: portfolio.availabilityDate })}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Certificates */}
      <Card>
        <CardHeader>
          <CardTitle>Certificates</CardTitle>
        </CardHeader>
        <CardContent>
          {availableCertificates.length > 0 ? (
            <div className="space-y-4">
              <p className="text-gray-600">
                Manage which certificates appear on your public portfolio.
              </p>
              <Link 
                href="/dashboard/portfolio/certificates"
                className="inline-block"
              >
                <Button>
                  Manage Portfolio Certificates
                </Button>
              </Link>
            </div>
          ) : (
            <p className="text-gray-600">
              Complete some courses to earn certificates that you can showcase on your portfolio.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}