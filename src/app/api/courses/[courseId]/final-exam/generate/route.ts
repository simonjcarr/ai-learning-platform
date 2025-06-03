import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { addCourseGenerationToQueue } from '@/lib/bullmq';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { courseId } = await params;

    // Verify user enrollment and eligibility (reuse status check logic)
    const statusResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/courses/${courseId}/final-exam/status`, {
      headers: { 
        'Authorization': `Bearer ${userId}`,
        'Cookie': request.headers.get('cookie') || '',
      },
    });

    if (!statusResponse.ok) {
      return NextResponse.json({ error: 'Failed to verify eligibility' }, { status: 400 });
    }

    const statusData = await statusResponse.json();
    if (!statusData.canTake) {
      return NextResponse.json({ 
        error: 'Not eligible to take final exam',
        reason: statusData.reason 
      }, { status: 400 });
    }

    // Check if final exam already exists for this course
    let finalExam = await prisma.courseQuiz.findFirst({
      where: {
        courseId,
        quizType: 'final_exam',
      },
    });

    if (!finalExam) {
      // Generate final exam using the worker
      console.log(`Generating final exam for course ${courseId}`);
      
      await addCourseGenerationToQueue({
        courseId,
        jobType: 'quiz_generation',
        context: { examType: 'final_exam' },
      });

      // Wait a moment for the job to complete (in a real app, you might use polling)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if exam was created
      finalExam = await prisma.courseQuiz.findFirst({
        where: {
          courseId,
          quizType: 'final_exam',
        },
      });

      if (!finalExam) {
        return NextResponse.json({ 
          error: 'Final exam generation is in progress. Please try again in a moment.' 
        }, { status: 202 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      examId: finalExam.quizId,
      message: 'Final exam is ready' 
    });
  } catch (error) {
    console.error('Error generating final exam:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}