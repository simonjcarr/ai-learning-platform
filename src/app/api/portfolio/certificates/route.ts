import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const addCertificateSchema = z.object({
  certificateId: z.string(),
  displayOrder: z.number().optional(),
});

const updateCertificatesOrderSchema = z.object({
  certificates: z.array(z.object({
    portfolioCertId: z.string(),
    displayOrder: z.number(),
  }))
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { certificateId, displayOrder } = addCertificateSchema.parse(body);

    // Verify the certificate belongs to the user
    const certificate = await prisma.courseCertificate.findFirst({
      where: {
        certificateId,
        clerkUserId: userId
      }
    });

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    // Get user's portfolio
    const portfolio = await prisma.portfolio.findUnique({
      where: { clerkUserId: userId }
    });

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Check if certificate is already in portfolio
    const existingPortfolioCert = await prisma.portfolioCertificate.findUnique({
      where: {
        portfolioId_certificateId: {
          portfolioId: portfolio.portfolioId,
          certificateId
        }
      }
    });

    if (existingPortfolioCert) {
      return NextResponse.json({ error: 'Certificate already in portfolio' }, { status: 400 });
    }

    // Get the next display order if not provided
    let finalDisplayOrder = displayOrder;
    if (finalDisplayOrder === undefined) {
      const maxOrder = await prisma.portfolioCertificate.findFirst({
        where: { portfolioId: portfolio.portfolioId },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true }
      });
      finalDisplayOrder = (maxOrder?.displayOrder || 0) + 1;
    }

    const portfolioCertificate = await prisma.portfolioCertificate.create({
      data: {
        portfolioId: portfolio.portfolioId,
        certificateId,
        displayOrder: finalDisplayOrder
      },
      include: {
        certificate: {
          include: {
            course: true
          }
        }
      }
    });

    return NextResponse.json(portfolioCertificate, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error adding certificate to portfolio:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { certificates } = updateCertificatesOrderSchema.parse(body);

    // Get user's portfolio
    const portfolio = await prisma.portfolio.findUnique({
      where: { clerkUserId: userId }
    });

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Update display orders
    const updates = certificates.map(cert => 
      prisma.portfolioCertificate.update({
        where: { 
          portfolioCertId: cert.portfolioCertId,
          portfolioId: portfolio.portfolioId // Ensure user owns the portfolio cert
        },
        data: { displayOrder: cert.displayOrder }
      })
    );

    await prisma.$transaction(updates);

    return NextResponse.json({ message: 'Certificate order updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error updating certificate order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}