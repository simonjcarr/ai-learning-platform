"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { CourseLevel } from "@prisma/client";
import Link from "next/link";
import { 
  BookOpen, 
  Clock, 
  Users, 
  Award, 
  Search, 
  Filter,
  TrendingUp,
  CheckCircle,
  Play,
  GraduationCap,
  Heart,
  Info,
  LogIn,
  CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CourseFeaturesPromotion } from "@/components/course-features-promotion";

interface Course {
  courseId: string;
  title: string;
  slug: string;
  description: string;
  level: CourseLevel;
  estimatedHours?: number;
  passMarkPercentage: number;
  createdAt: string;
  publishedAt?: string;
  createdBy: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  totalSections: number;
  totalArticles: number;
  generatedArticles: number;
  enrollmentCount: number;
  certificateCount: number;
  likesCount: number;
  isEnrolled: boolean;
  enrolledAt?: string;
  isCompleted: boolean;
  completedAt?: string;
  progressPercentage: number;
  completedArticles: number;
  certificateId?: string | null;
}

export default function CoursesPage() {
  const { user, isSignedIn } = useAuth();
  const { access: courseAccess, loading: accessLoading } = useFeatureAccess("access_courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    filterCourses();
  }, [courses, searchTerm, levelFilter]);

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/courses');
      
      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }
      
      const data = await response.json();
      setCourses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const filterCourses = () => {
    let filtered = courses;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Level filter
    if (levelFilter !== "all") {
      filtered = filtered.filter(course => course.level === levelFilter);
    }

    setFilteredCourses(filtered);
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

  const enrolledCourses = filteredCourses.filter(course => course.isEnrolled);
  const allAvailableCourses = filteredCourses.filter(course => !course.isEnrolled);
  
  // Featured courses are the most popular non-enrolled courses
  const featuredCourses = allAvailableCourses
    .sort((a, b) => (b.enrollmentCount + b.likesCount) - (a.enrollmentCount + a.likesCount))
    .slice(0, 3);
    
  // Available courses excluding featured ones
  const featuredCourseIds = new Set(featuredCourses.map(c => c.courseId));
  const availableCourses = allAvailableCourses.filter(course => !featuredCourseIds.has(course.courseId));

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="p-6">
          <div className="text-center text-red-600">
            Error loading courses: {error}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Courses</h1>
              <p className="text-lg text-gray-600">
                Comprehensive learning paths designed to take you from beginner to expert
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <CourseFeaturesPromotion trigger={(
                <Button variant="outline" className="flex items-center space-x-2">
                  <Info className="h-4 w-4" />
                  <span>About Our Courses</span>
                </Button>
              )} />
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 bg-white"
            >
              <option value="all">All Levels</option>
              <option value={CourseLevel.BEGINNER}>Beginner</option>
              <option value={CourseLevel.INTERMEDIATE}>Intermediate</option>
              <option value={CourseLevel.ADVANCED}>Advanced</option>
            </select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center">
              <GraduationCap className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Courses</p>
                <p className="text-2xl font-bold text-gray-900">{courses.length}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Enrolled</p>
                <p className="text-2xl font-bold text-gray-900">{enrolledCourses.length}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {enrolledCourses.filter(course => course.isCompleted).length}
                </p>
              </div>
            </div>
          </Card>
          
          {isSignedIn ? (
            <Link href="/dashboard/certificates" className="block">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-center">
                  <Award className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Certificates</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {enrolledCourses.filter(course => course.certificateId).length}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ) : (
            <Card className="p-6">
              <div className="flex items-center">
                <Award className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Certificates</p>
                  <p className="text-2xl font-bold text-gray-900">-</p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Enrolled Courses Section */}
        {isSignedIn && enrolledCourses.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Enrolled Courses</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrolledCourses.map((course) => (
                <Card key={course.courseId} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {course.title}
                      </h3>
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={getLevelBadgeColor(course.level)}>
                          {course.level}
                        </Badge>
                        {course.isCompleted && (
                          <Badge className="bg-green-100 text-green-800">
                            Completed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {course.description}
                  </p>
                  
                  {/* Progress Bar or Completion Status */}
                  {!course.isCompleted ? (
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">Progress</span>
                        <span className="text-sm font-medium text-gray-700">
                          {course.progressPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-orange-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${course.progressPercentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {course.completedArticles} of {course.totalArticles} articles completed
                      </p>
                    </div>
                  ) : (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                          <div>
                            <p className="text-sm font-semibold text-green-800">Course Completed!</p>
                            <p className="text-xs text-green-600">
                              Completed on {new Date(course.completedAt!).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {course.certificateId && (
                          <Link href={`/dashboard/certificates/${course.certificateId}`}>
                            <Button size="sm" variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                              <Award className="h-4 w-4 mr-1" />
                              View Certificate
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 mr-1" />
                      {course.totalSections} sections
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      {course.enrollmentCount} enrolled
                    </div>
                    <div className="flex items-center">
                      <Heart className="h-4 w-4 mr-1" />
                      {course.likesCount} likes
                    </div>
                    {course.estimatedHours && (
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {course.estimatedHours}h
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Link href={`/courses/${course.courseId}`} className="flex-1">
                      <Button className="w-full">
                        <Play className="h-4 w-4 mr-2" />
                        {course.isCompleted ? 'Review' : 'Continue'}
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Featured Courses Section */}
        {featuredCourses.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Courses</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredCourses.map((course) => (
                <Card key={course.courseId} className="p-6 hover:shadow-lg transition-shadow border-2 border-orange-100">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {course.title}
                      </h3>
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={getLevelBadgeColor(course.level)}>
                          {course.level}
                        </Badge>
                        <Badge className="bg-orange-100 text-orange-800">
                          Featured
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-4 line-clamp-3">
                    {course.description}
                  </p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 mr-1" />
                      {course.totalSections} sections
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      {course.enrollmentCount} enrolled
                    </div>
                    <div className="flex items-center">
                      <Heart className="h-4 w-4 mr-1" />
                      {course.likesCount} likes
                    </div>
                    {course.estimatedHours && (
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {course.estimatedHours}h
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>Created by {course.createdBy.firstName} {course.createdBy.lastName}</span>
                    <span>{new Date(course.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <Link href={`/courses/${course.courseId}`}>
                      <Button className="w-full bg-orange-600 hover:bg-orange-700">
                        View Course
                      </Button>
                    </Link>
                    {!isSignedIn && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-2">Sign in to enroll and start learning</p>
                        <div className="flex space-x-2">
                          <Link href="/sign-in" className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              <LogIn className="h-3 w-3 mr-1" />
                              Sign In
                            </Button>
                          </Link>
                          <Link href="/sign-up" className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              Sign Up
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}
                    {isSignedIn && !courseAccess?.hasAccess && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-2">Upgrade to access course content</p>
                        <Link href="/pricing">
                          <Button variant="outline" size="sm" className="w-full">
                            <CreditCard className="h-3 w-3 mr-1" />
                            Upgrade
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Available Courses Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {enrolledCourses.length > 0 ? 'Available Courses' : 'All Courses'}
          </h2>
          
          {allAvailableCourses.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <GraduationCap className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No courses found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || levelFilter !== "all" 
                    ? "Try adjusting your search or filter criteria."
                    : "New courses will appear here as they become available."
                  }
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableCourses.map((course) => (
                <Card key={course.courseId} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {course.title}
                      </h3>
                      <Badge className={getLevelBadgeColor(course.level)}>
                        {course.level}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-4 line-clamp-3">
                    {course.description}
                  </p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 mr-1" />
                      {course.totalSections} sections
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      {course.enrollmentCount} enrolled
                    </div>
                    <div className="flex items-center">
                      <Heart className="h-4 w-4 mr-1" />
                      {course.likesCount} likes
                    </div>
                    {course.estimatedHours && (
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {course.estimatedHours}h
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>Created by {course.createdBy.firstName} {course.createdBy.lastName}</span>
                    <span>{new Date(course.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <Link href={`/courses/${course.courseId}`}>
                      <Button className="w-full">
                        View Course
                      </Button>
                    </Link>
                    {!isSignedIn && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-2">Sign in to enroll and start learning</p>
                        <div className="flex space-x-2">
                          <Link href="/sign-in" className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              <LogIn className="h-3 w-3 mr-1" />
                              Sign In
                            </Button>
                          </Link>
                          <Link href="/sign-up" className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              Sign Up
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}
                    {isSignedIn && !courseAccess?.hasAccess && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-2">Upgrade to access course content</p>
                        <Link href="/pricing">
                          <Button variant="outline" size="sm" className="w-full">
                            <CreditCard className="h-3 w-3 mr-1" />
                            Upgrade
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
  );
}

