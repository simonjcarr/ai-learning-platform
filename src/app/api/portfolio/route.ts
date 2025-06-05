import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createPortfolioSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  displayName: z.string().optional(),
  bio: z.string().optional(),
  location: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  githubUrl: z.string().url().optional().or(z.literal('')),
  isPublic: z.boolean().default(false),
  isAvailableForWork: z.boolean().default(false),
  jobTypes: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  preferredJobTitles: z.array(z.string()).default([]),
  salaryRange: z.string().optional(),
  availabilityDate: z.string().datetime().optional(),
});

const updatePortfolioSchema = createPortfolioSchema.partial();

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const portfolio = await prisma.portfolio.findUnique({
      where: { clerkUserId: userId },
      include: {
        certificates: {
          include: {
            certificate: {
              include: {
                course: true
              }
            }
          },
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createPortfolioSchema.parse(body);

    // Check if user already has a portfolio
    const existingPortfolio = await prisma.portfolio.findUnique({
      where: { clerkUserId: userId }
    });

    if (existingPortfolio) {
      return NextResponse.json({ error: 'Portfolio already exists' }, { status: 400 });
    }

    // Check if slug is already taken
    const existingSlug = await prisma.portfolio.findUnique({
      where: { slug: validatedData.slug }
    });

    if (existingSlug) {
      return NextResponse.json({ error: 'Slug already taken' }, { status: 400 });
    }

    const portfolio = await prisma.portfolio.create({
      data: {
        ...validatedData,
        clerkUserId: userId,
        availabilityDate: validatedData.availabilityDate 
          ? new Date(validatedData.availabilityDate) 
          : null,
      },
      include: {
        certificates: {
          include: {
            certificate: {
              include: {
                course: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(portfolio, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error creating portfolio:', error);
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
    const validatedData = updatePortfolioSchema.parse(body);

    // Find user's portfolio
    const existingPortfolio = await prisma.portfolio.findUnique({
      where: { clerkUserId: userId }
    });

    if (!existingPortfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Check if slug is being changed and if it's taken
    if (validatedData.slug && validatedData.slug !== existingPortfolio.slug) {
      const existingSlug = await prisma.portfolio.findUnique({
        where: { slug: validatedData.slug }
      });

      if (existingSlug) {
        return NextResponse.json({ error: 'Slug already taken' }, { status: 400 });
      }
    }

    const updatedPortfolio = await prisma.portfolio.update({
      where: { clerkUserId: userId },
      data: {
        ...validatedData,
        availabilityDate: validatedData.availabilityDate 
          ? new Date(validatedData.availabilityDate) 
          : undefined,
      },
      include: {
        certificates: {
          include: {
            certificate: {
              include: {
                course: true
              }
            }
          },
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    return NextResponse.json(updatedPortfolio);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error updating portfolio:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.portfolio.delete({
      where: { clerkUserId: userId }
    });

    return NextResponse.json({ message: 'Portfolio deleted successfully' });
  } catch (error) {
    console.error('Error deleting portfolio:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}