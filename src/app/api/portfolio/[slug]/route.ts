import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const portfolio = await prisma.portfolio.findUnique({
      where: { 
        slug,
        isPublic: true // Only return public portfolios
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            imageUrl: true,
            username: true
          }
        },
        certificates: {
          include: {
            certificate: {
              include: {
                course: {
                  select: {
                    title: true,
                    level: true,
                    description: true
                  }
                }
              }
            }
          },
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}