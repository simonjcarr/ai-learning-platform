'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftIcon, PlusIcon, XIcon, GripVerticalIcon } from 'lucide-react';
import Link from 'next/link';

interface Certificate {
  certificateId: string;
  issuedAt: string;
  grade: 'BRONZE' | 'SILVER' | 'GOLD' | null;
  finalScore: number | null;
  engagementScore: number | null;
  certificateData: any;
  course: {
    title: string;
    level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    description: string;
  };
}

interface PortfolioCertificate {
  portfolioCertId: string;
  displayOrder: number;
  addedAt: string;
  certificate: Certificate;
}

export default function PortfolioCertificatesPage() {
  const router = useRouter();
  const [portfolioCertificates, setPortfolioCertificates] = useState<PortfolioCertificate[]>([]);
  const [availableCertificates, setAvailableCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [portfolioResponse, availableResponse] = await Promise.all([
        fetch('/api/portfolio'),
        fetch('/api/certificates/available')
      ]);

      if (portfolioResponse.ok) {
        const portfolioData = await portfolioResponse.json();
        if (portfolioData?.certificates) {
          setPortfolioCertificates(portfolioData.certificates);
        }
      }

      if (availableResponse.ok) {
        const availableData = await availableResponse.json();
        setAvailableCertificates(availableData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCertificateToPortfolio = async (certificateId: string) => {
    try {
      const response = await fetch('/api/portfolio/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificateId })
      });

      if (response.ok) {
        fetchData(); // Refresh the data
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add certificate');
      }
    } catch (error) {
      console.error('Error adding certificate:', error);
      alert('Failed to add certificate');
    }
  };

  const removeCertificateFromPortfolio = async (portfolioCertId: string) => {
    try {
      const response = await fetch(`/api/portfolio/certificates/${portfolioCertId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchData(); // Refresh the data
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to remove certificate');
      }
    } catch (error) {
      console.error('Error removing certificate:', error);
      alert('Failed to remove certificate');
    }
  };

  const getGradeColor = (grade: 'BRONZE' | 'SILVER' | 'GOLD' | null) => {
    switch (grade) {
      case 'GOLD':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'SILVER':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'BRONZE':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getLevelColor = (level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED') => {
    switch (level) {
      case 'BEGINNER':
        return 'bg-green-100 text-green-800';
      case 'INTERMEDIATE':
        return 'bg-yellow-100 text-yellow-800';
      case 'ADVANCED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-gray-600">Loading certificates...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/portfolio">
          <Button variant="outline" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Portfolio
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Portfolio Certificates</h1>
      </div>

      {/* Current Portfolio Certificates */}
      <Card>
        <CardHeader>
          <CardTitle>Certificates in Your Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          {portfolioCertificates.length > 0 ? (
            <div className="space-y-4">
              {portfolioCertificates.map((portfolioCert) => (
                <div
                  key={portfolioCert.portfolioCertId}
                  className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg"
                >
                  <div className="cursor-move text-gray-400">
                    <GripVerticalIcon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {portfolioCert.certificate.course.title}
                      </h3>
                      <div className="flex gap-2">
                        {portfolioCert.certificate.grade && (
                          <Badge 
                            variant="outline" 
                            className={getGradeColor(portfolioCert.certificate.grade)}
                          >
                            {portfolioCert.certificate.grade}
                          </Badge>
                        )}
                        <Badge 
                          variant="secondary" 
                          className={getLevelColor(portfolioCert.certificate.course.level)}
                        >
                          {portfolioCert.certificate.course.level}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-2">
                      {portfolioCert.certificate.course.description}
                    </p>
                    
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span>
                        Completed: {new Date(portfolioCert.certificate.issuedAt).toLocaleDateString()}
                      </span>
                      {portfolioCert.certificate.finalScore && (
                        <span>
                          Score: {Math.round(portfolioCert.certificate.finalScore)}%
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeCertificateFromPortfolio(portfolioCert.portfolioCertId)}
                  >
                    <XIcon className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                No certificates in your portfolio yet.
              </p>
              <p className="text-sm text-gray-500">
                Add certificates from the available certificates below.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Certificates */}
      <Card>
        <CardHeader>
          <CardTitle>Available Certificates</CardTitle>
        </CardHeader>
        <CardContent>
          {availableCertificates.length > 0 ? (
            <div className="grid gap-4">
              {availableCertificates.map((certificate) => (
                <div
                  key={certificate.certificateId}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {certificate.course.title}
                      </h3>
                      <div className="flex gap-2">
                        {certificate.grade && (
                          <Badge 
                            variant="outline" 
                            className={getGradeColor(certificate.grade)}
                          >
                            {certificate.grade}
                          </Badge>
                        )}
                        <Badge 
                          variant="secondary" 
                          className={getLevelColor(certificate.course.level)}
                        >
                          {certificate.course.level}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-2">
                      {certificate.course.description}
                    </p>
                    
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span>
                        Completed: {new Date(certificate.issuedAt).toLocaleDateString()}
                      </span>
                      {certificate.finalScore && (
                        <span>
                          Score: {Math.round(certificate.finalScore)}%
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => addCertificateToPortfolio(certificate.certificateId)}
                    size="sm"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add to Portfolio
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                All your certificates are already in your portfolio.
              </p>
              <p className="text-sm text-gray-500">
                Complete more courses to earn additional certificates.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}