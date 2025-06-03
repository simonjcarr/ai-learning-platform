"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Award, Eye, Download, Search, Filter, Calendar, User, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CourseLevel, CertificateGrade } from "@prisma/client";

interface CertificateWithDetails {
  certificateId: string;
  courseId: string;
  clerkUserId: string;
  issuedAt: string;
  grade: CertificateGrade;
  finalScore: number;
  engagementScore: number;
  certificateData: any;
  course: {
    title: string;
    slug: string;
    level: CourseLevel;
  };
  user: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

export default function AdminCertificatesPage() {
  const [certificates, setCertificates] = useState<CertificateWithDetails[]>([]);
  const [filteredCertificates, setFilteredCertificates] = useState<CertificateWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");

  useEffect(() => {
    fetchCertificates();
  }, []);

  useEffect(() => {
    filterCertificates();
  }, [certificates, searchTerm, gradeFilter]);

  const fetchCertificates = async () => {
    try {
      const response = await fetch('/api/admin/certificates');
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

  const filterCertificates = () => {
    let filtered = certificates;

    if (searchTerm) {
      filtered = filtered.filter(cert =>
        cert.course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${cert.user.firstName} ${cert.user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (gradeFilter !== "all") {
      filtered = filtered.filter(cert => cert.grade === gradeFilter);
    }

    setFilteredCertificates(filtered);
  };

  const getGradeBadgeColor = (grade: CertificateGrade) => {
    switch (grade) {
      case CertificateGrade.GOLD:
        return 'bg-yellow-100 text-yellow-800';
      case CertificateGrade.SILVER:
        return 'bg-gray-100 text-gray-800';
      case CertificateGrade.BRONZE:
        return 'bg-orange-100 text-orange-800';
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Certificate Management</h1>
        <p className="text-gray-600">View and manage all course completion certificates</p>
      </div>

      {/* Filters */}
      <Card className="p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by student name, email, or course..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              <SelectItem value="GOLD">Gold</SelectItem>
              <SelectItem value="SILVER">Silver</SelectItem>
              <SelectItem value="BRONZE">Bronze</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Filter className="h-4 w-4" />
            <span>Showing {filteredCertificates.length} of {certificates.length} certificates</span>
          </div>
        </div>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center">
            <Award className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Certificates</p>
              <p className="text-2xl font-semibold text-gray-900">{certificates.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <Award className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Gold Certificates</p>
              <p className="text-2xl font-semibold text-gray-900">
                {certificates.filter(c => c.grade === CertificateGrade.GOLD).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <Award className="h-8 w-8 text-gray-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Silver Certificates</p>
              <p className="text-2xl font-semibold text-gray-900">
                {certificates.filter(c => c.grade === CertificateGrade.SILVER).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <Award className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Bronze Certificates</p>
              <p className="text-2xl font-semibold text-gray-900">
                {certificates.filter(c => c.grade === CertificateGrade.BRONZE).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Certificates List */}
      {filteredCertificates.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Award className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Certificates Found</h2>
            <p className="text-gray-600">
              {searchTerm || gradeFilter !== "all" 
                ? "Try adjusting your filters to see more results"
                : "No certificates have been issued yet"
              }
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCertificates.map((certificate) => (
            <Card key={certificate.certificateId} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <Award className={`h-6 w-6 ${
                      certificate.grade === CertificateGrade.GOLD ? 'text-yellow-600' :
                      certificate.grade === CertificateGrade.SILVER ? 'text-gray-600' :
                      'text-orange-600'
                    }`} />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {certificate.course.title}
                    </h3>
                    <Badge className={getGradeBadgeColor(certificate.grade)}>
                      {certificate.grade}
                    </Badge>
                    <Badge className={getLevelBadgeColor(certificate.course.level)}>
                      {certificate.course.level}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span>
                        {certificate.user.firstName && certificate.user.lastName
                          ? `${certificate.user.firstName} ${certificate.user.lastName}`
                          : certificate.user.email
                        }
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>Issued: {new Date(certificate.issuedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-4 w-4" />
                      <span>Score: {certificate.finalScore?.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs">
                        ID: {certificate.certificateId.slice(-8)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Link href={`/dashboard/certificates/${certificate.certificateId}`}>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}