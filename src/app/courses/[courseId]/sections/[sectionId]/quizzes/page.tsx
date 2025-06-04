"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import CourseQuiz from "@/components/course-quiz";
import { CourseFloatingActionMenu } from "@/components/course-floating-action-menu";
import { useAuth } from "@clerk/nextjs";

interface PageParams {
  params: Promise<{
    courseId: string;
    sectionId: string;
  }>;
}

export default function SectionQuizzesPage({ params }: PageParams) {
  const router = useRouter();
  const { courseId, sectionId } = use(params);
  const { isSignedIn } = useAuth();
  
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <Link href={`/courses/${courseId}`}>
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Course
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Section Quizzes</h1>
      </div>

      {/* Course Quiz Component with section ID */}
      <CourseQuiz sectionId={sectionId} />
      
      {/* Floating Action Menu */}
      {isSignedIn && (
        <CourseFloatingActionMenu 
          courseId={courseId}
          currentQuizId={sectionId}
        />
      )}
    </div>
  );
}