import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { quizId } = await params;

    // Check if quiz exists
    const quiz = await prisma.courseQuiz.findUnique({
      where: { quizId },
      include: {
        article: {
          include: {
            section: {
              include: {
                course: true,
              },
            },
          },
        },
        section: {
          include: {
            course: true,
          },
        },
        course: true,
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Delete the quiz (this will cascade delete questions and attempts)
    await prisma.courseQuiz.delete({
      where: { quizId },
    });

    // Log the deletion
    console.log(`🗑️ Deleted quiz ${quizId} (${quiz.title}) by admin ${userId}`);

    return NextResponse.json({
      success: true,
      message: `Quiz "${quiz.title}" deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}