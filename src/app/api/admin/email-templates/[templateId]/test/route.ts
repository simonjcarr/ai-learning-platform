import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { addEmailToQueue } from "@/lib/bullmq";
import { z } from "zod";

const testEmailSchema = z.object({
  to: z.string().email(),
  variables: z.record(z.string()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true, email: true },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = testEmailSchema.parse(body);

    const template = await prisma.emailTemplate.findUnique({
      where: { templateId: params.templateId, isActive: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found or inactive" },
        { status: 404 }
      );
    }

    // Add email to queue
    const job = await addEmailToQueue({
      to: validated.to,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent || undefined,
      template: template.templateKey,
      templateData: validated.variables,
      from: template.fromEmail && template.fromName 
        ? `${template.fromName} <${template.fromEmail}>`
        : template.fromEmail || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Test email queued successfully",
      jobId: job.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error sending test email:", error);
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    );
  }
}