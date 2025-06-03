import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function GET() {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin/moderator
    if (user.role !== Role.ADMIN && user.role !== Role.MODERATOR) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all certificates with course and user details
    const certificates = await prisma.courseCertificate.findMany({
      include: {
        course: {
          select: {
            title: true,
            slug: true,
            level: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });

    return NextResponse.json(certificates);
  } catch (error) {
    console.error("Failed to fetch certificates:", error);
    return NextResponse.json(
      { error: "Failed to fetch certificates" },
      { status: 500 }
    );
  }
}