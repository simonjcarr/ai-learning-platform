import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { portfolioCertId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { portfolioCertId } = params;

    // Verify the portfolio certificate belongs to the user
    const portfolioCert = await prisma.portfolioCertificate.findFirst({
      where: {
        portfolioCertId,
        portfolio: {
          clerkUserId: userId
        }
      }
    });

    if (!portfolioCert) {
      return NextResponse.json({ error: 'Portfolio certificate not found' }, { status: 404 });
    }

    await prisma.portfolioCertificate.delete({
      where: { portfolioCertId }
    });

    return NextResponse.json({ message: 'Certificate removed from portfolio successfully' });
  } catch (error) {
    console.error('Error removing certificate from portfolio:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}