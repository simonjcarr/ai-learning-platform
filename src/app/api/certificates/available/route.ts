import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all user's certificates that are not already in their portfolio
    const certificates = await prisma.courseCertificate.findMany({
      where: {
        clerkUserId: userId,
        portfolioCerts: {
          none: {} // Not in any portfolio
        }
      },
      include: {
        course: {
          select: {
            title: true,
            level: true,
            description: true
          }
        }
      },
      orderBy: {
        issuedAt: 'desc'
      }
    });

    return NextResponse.json(certificates);
  } catch (error) {
    console.error('Error fetching available certificates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}