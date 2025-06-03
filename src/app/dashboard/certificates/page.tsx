"use client";

import { useState, useEffect } from "react";
import { Award, Download, Eye, Calendar, Clock, Target } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourseLevel, CertificateGrade } from "@prisma/client";
import { generateCertificatePDF } from "@/lib/pdf-generator";

interface Certificate {
  certificateId: string;
  courseId: string;
  issuedAt: string;
  grade: CertificateGrade;
  finalScore: number;
  engagementScore: number;
  certificateData: any;
  course: {
    courseId: string;
    title: string;
    slug: string;
    level: CourseLevel;
    description: string;
  };
}

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      const response = await fetch('/api/certificates');
      if (!response.ok) {
        throw new Error('Failed to fetch certificates');
      }
      const data = await response.json();
      setCertificates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (certificate: Certificate) => {
    if (!certificate.certificateData) return;

    setDownloadingId(certificate.certificateId);
    try {
      await generateCertificatePDF(certificate.certificateData);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate certificate PDF. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const getGradeBadgeColor = (grade: CertificateGrade) => {
    switch (grade) {
      case CertificateGrade.GOLD:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case CertificateGrade.SILVER:
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case CertificateGrade.BRONZE:
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getLevelBadgeColor = (level: CourseLevel) => {
    switch (level) {
      case CourseLevel.BEGINNER:
        return 'bg-green-100 text-green-800';
      case CourseLevel.INTERMEDIATE:
        return 'bg-yellow-100 text-yellow-800';
      case CourseLevel.ADVANCED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getGradeIcon = (grade: CertificateGrade) => {
    return (
      <Award className={`h-8 w-8 ${
        grade === CertificateGrade.GOLD ? 'text-yellow-600' :
        grade === CertificateGrade.SILVER ? 'text-gray-600' :
        'text-orange-600'
      }`} />
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="p-6">
          <div className="text-center text-red-600">{error}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Certificates</h1>
        <p className="text-gray-600">View and download your course completion certificates</p>
      </div>

      {certificates.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Award className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Certificates Yet</h2>
            <p className="text-gray-600 mb-6">
              Complete courses and pass final exams to earn certificates
            </p>
            <Link href="/courses">
              <Button>Browse Courses</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((certificate) => (
            <Card key={certificate.certificateId} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className={`p-6 ${
                certificate.grade === CertificateGrade.GOLD ? 'bg-gradient-to-br from-yellow-50 to-yellow-100' :
                certificate.grade === CertificateGrade.SILVER ? 'bg-gradient-to-br from-gray-50 to-gray-100' :
                'bg-gradient-to-br from-orange-50 to-orange-100'
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {certificate.course.title}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <Badge className={getLevelBadgeColor(certificate.course.level)}>
                        {certificate.course.level}
                      </Badge>
                      <Badge className={getGradeBadgeColor(certificate.grade)}>
                        {certificate.grade}
                      </Badge>
                    </div>
                  </div>
                  {getGradeIcon(certificate.grade)}
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    Issued: {new Date(certificate.issuedAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Target className="h-4 w-4 mr-2" />
                    Final Score: {certificate.finalScore?.toFixed(1) || 'N/A'}%
                  </div>
                  {certificate.certificateData?.finalExamScore && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Target className="h-4 w-4 mr-2" />
                      Final Exam: {certificate.certificateData.finalExamScore}%
                    </div>
                  )}
                  {certificate.certificateData?.timeInvested && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-2" />
                      Time Invested: {certificate.certificateData.timeInvested}h
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <Link href={`/dashboard/certificates/${certificate.certificateId}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  </Link>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleDownload(certificate)}
                    disabled={downloadingId === certificate.certificateId}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {downloadingId === certificate.certificateId ? 'Generating...' : 'Download'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}