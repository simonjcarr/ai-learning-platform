import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// GET /api/courses/[courseId]/like
export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if the user has liked this course
    const like = await prisma.courseLike.findUnique({
      where: {
        courseId_clerkUserId: {
          courseId: params.courseId,
          clerkUserId: userId,
        }
      }
    });

    return NextResponse.json({ liked: !!like });
  } catch (error) {
    console.error('Error checking course like:', error);
    return NextResponse.json(
      { error: 'Failed to check like status' },
      { status: 500 }
    );
  }
}

// POST /api/courses/[courseId]/like
export async function POST(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the course exists
    const course = await prisma.course.findUnique({
      where: { courseId: params.courseId }
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Check if already liked
    const existingLike = await prisma.courseLike.findUnique({
      where: {
        courseId_clerkUserId: {
          courseId: params.courseId,
          clerkUserId: userId,
        }
      }
    });

    if (existingLike) {
      // Unlike - remove the like and decrement count
      await prisma.$transaction([
        prisma.courseLike.delete({
          where: {
            likeId: existingLike.likeId
          }
        }),
        prisma.course.update({
          where: { courseId: params.courseId },
          data: { likesCount: { decrement: 1 } }
        })
      ]);

      return NextResponse.json({ liked: false });
    } else {
      // Like - create like and increment count
      await prisma.$transaction([
        prisma.courseLike.create({
          data: {
            courseId: params.courseId,
            clerkUserId: userId,
          }
        }),
        prisma.course.update({
          where: { courseId: params.courseId },
          data: { likesCount: { increment: 1 } }
        })
      ]);

      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error('Error toggling course like:', error);
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    );
  }
}