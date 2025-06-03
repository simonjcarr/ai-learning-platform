import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { certificateId } = await params;

    // Get the certificate
    const certificate = await prisma.courseCertificate.findUnique({
      where: { certificateId },
      include: {
        course: {
          select: {
            courseId: true,
            title: true,
            slug: true,
            level: true,
            description: true,
            estimatedHours: true,
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
    });

    if (!certificate) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 }
      );
    }

    // Ensure the certificate belongs to the requesting user
    if (certificate.clerkUserId !== user.clerkUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    return NextResponse.json(certificate);
  } catch (error) {
    console.error("Failed to fetch certificate:", error);
    return NextResponse.json(
      { error: "Failed to fetch certificate" },
      { status: 500 }
    );
  }
}