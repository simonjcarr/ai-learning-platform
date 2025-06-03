import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all certificates for the user
    const certificates = await prisma.courseCertificate.findMany({
      where: { clerkUserId: user.clerkUserId },
      include: {
        course: {
          select: {
            courseId: true,
            title: true,
            slug: true,
            level: true,
            description: true,
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