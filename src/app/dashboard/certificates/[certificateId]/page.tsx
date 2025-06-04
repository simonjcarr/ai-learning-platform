"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Award, Download, ArrowLeft, Calendar, Clock, Target, TrendingUp, CheckCircle, Star, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourseLevel, CertificateGrade } from "@prisma/client";
import { generateCertificatePDF } from "@/lib/pdf-generator";

interface CertificateDetail {
  certificateId: string;
  courseId: string;
  issuedAt: string;
  grade: CertificateGrade;
  finalScore: number;
  engagementScore: number;
  certificateData: {
    courseName: string;
    courseLevel: CourseLevel;
    studentName: string;
    completionDate: string;
    certificateNumber: string;
    grade: CertificateGrade;
    finalScore: number;
    finalExamScore: number;
    engagementScore: number;
    quizAverage: number;
    timeInvested: number;
    instructorName: string;
  };
  course: {
    courseId: string;
    title: string;
    slug: string;
    level: CourseLevel;
    description: string;
    estimatedHours?: number;
  };
  user: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

export default function CertificateDetailPage({ params }: { params: Promise<{ certificateId: string }> }) {
  const router = useRouter();
  const { certificateId } = use(params);
  const [certificate, setCertificate] = useState<CertificateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchCertificate();
  }, [certificateId]);

  const fetchCertificate = async () => {
    try {
      const response = await fetch(`/api/certificates/${certificateId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Certificate not found');
          return;
        }
        throw new Error('Failed to fetch certificate');
      }
      const data = await response.json();
      setCertificate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load certificate');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!certificate) return;

    setDownloading(true);
    try {
      await generateCertificatePDF(certificate.certificateData);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate certificate PDF. Please try again.');
    } finally {
      setDownloading(false);
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

  const getGradeColor = (grade: CertificateGrade) => {
    switch (grade) {
      case CertificateGrade.GOLD:
        return 'text-yellow-600';
      case CertificateGrade.SILVER:
        return 'text-gray-600';
      case CertificateGrade.BRONZE:
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/dashboard/certificates">
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Certificates
          </Button>
        </Link>
        <Card className="p-6">
          <div className="text-center text-red-600">
            {error || 'Certificate not found'}
          </div>
        </Card>
      </div>
    );
  }

  const certData = certificate.certificateData;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-6">
        <Link href="/dashboard/certificates">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Certificates
          </Button>
        </Link>
      </div>

      {/* Certificate Preview */}
      <Card className={`mb-8 overflow-hidden ${
        certificate.grade === CertificateGrade.GOLD ? 'ring-2 ring-yellow-400' :
        certificate.grade === CertificateGrade.SILVER ? 'ring-2 ring-gray-400' :
        'ring-2 ring-orange-400'
      }`}>
        <div className={`p-12 text-center ${
          certificate.grade === CertificateGrade.GOLD ? 'bg-gradient-to-br from-yellow-50 via-yellow-100 to-yellow-50' :
          certificate.grade === CertificateGrade.SILVER ? 'bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50' :
          'bg-gradient-to-br from-orange-50 via-orange-100 to-orange-50'
        }`}>
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <Award className={`h-20 w-20 mx-auto mb-4 ${getGradeColor(certificate.grade)}`} />
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Certificate of Completion</h1>
              <Badge className={`${getGradeBadgeColor(certificate.grade)} text-lg px-4 py-1`}>
                {certificate.grade} GRADE
              </Badge>
            </div>

            {/* Student Name */}
            <div className="mb-8">
              <p className="text-gray-600 mb-2">This is to certify that</p>
              <h2 className="text-3xl font-bold text-gray-900">{certData.studentName}</h2>
            </div>

            {/* Course Details */}
            <div className="mb-8">
              <p className="text-gray-600 mb-2">has successfully completed the course</p>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">{certData.courseName}</h3>
              <Badge className={getLevelBadgeColor(certData.courseLevel)}>
                {certData.courseLevel} LEVEL
              </Badge>
            </div>

            {/* Achievement Details */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div>
                <div className="text-2xl font-bold text-gray-900">{certData.finalScore}%</div>
                <div className="text-sm text-gray-600">Final Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{certData.finalExamScore}%</div>
                <div className="text-sm text-gray-600">Final Exam</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{certData.quizAverage}%</div>
                <div className="text-sm text-gray-600">Quiz Average</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{certData.engagementScore}%</div>
                <div className="text-sm text-gray-600">Engagement</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{certData.timeInvested}h</div>
                <div className="text-sm text-gray-600">Time Invested</div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                <div>
                  <p className="font-semibold">Date of Completion</p>
                  <p>{new Date(certData.completionDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</p>
                </div>
                <div>
                  <p className="font-semibold">Certificate Number</p>
                  <p className="font-mono">{certData.certificateNumber}</p>
                </div>
                <div>
                  <p className="font-semibold">Instructor</p>
                  <p>{certData.instructorName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <Button onClick={handleDownload} size="lg" disabled={downloading}>
          <Download className="h-4 w-4 mr-2" />
          {downloading ? 'Generating PDF...' : 'Download Certificate'}
        </Button>
        <Link href={`/dashboard/certificates/${certificate.certificateId}/summary`}>
          <Button variant="outline" size="lg">
            <FileText className="h-4 w-4 mr-2" />
            Learning Summary
          </Button>
        </Link>
        <Link href={`/courses/${certificate.course.slug}`}>
          <Button variant="outline" size="lg">
            View Course
          </Button>
        </Link>
      </div>

      {/* Additional Details */}
      <Card className="mt-8 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Certificate Details</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-gray-600">Course</span>
            <span className="font-medium">{certificate.course.title}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-gray-600">Level</span>
            <Badge className={getLevelBadgeColor(certificate.course.level)}>
              {certificate.course.level}
            </Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-gray-600">Grade Achieved</span>
            <Badge className={getGradeBadgeColor(certificate.grade)}>
              {certificate.grade}
            </Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-gray-600">Issue Date</span>
            <span className="font-medium">
              {new Date(certificate.issuedAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-600">Verification ID</span>
            <span className="font-mono text-sm">{certificate.certificateId}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}