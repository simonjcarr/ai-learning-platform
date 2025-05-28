import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createTemplateSchema = z.object({
  templateKey: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, {
    message: "Template key must contain only lowercase letters, numbers, and underscores",
  }),
  templateName: z.string().min(1).max(100),
  description: z.string().optional(),
  subject: z.string().min(1),
  htmlContent: z.string().min(1),
  textContent: z.string().optional(),
  fromEmail: z.string().email().optional().or(z.literal("")),
  fromName: z.string().optional(),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string(),
    defaultValue: z.string().optional(),
  })).optional(),
});

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const templates = await prisma.emailTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { emailLogs: true },
        },
      },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching email templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch email templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    console.log("Creating email template - userId:", userId);
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    console.log("User role:", user?.role);

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    console.log("Request body:", JSON.stringify(body, null, 2));
    
    // Clean empty strings to null/undefined
    const cleanedBody = {
      ...body,
      description: body.description || undefined,
      textContent: body.textContent || undefined,
      fromEmail: body.fromEmail || undefined,
      fromName: body.fromName || undefined,
    };
    
    const validated = createTemplateSchema.parse(cleanedBody);

    // Check if template key already exists
    const existing = await prisma.emailTemplate.findUnique({
      where: { templateKey: validated.templateKey },
    });

    if (existing) {
      console.log("Template key already exists:", validated.templateKey);
      return NextResponse.json(
        { error: "Template key already exists" },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        ...validated,
        variables: validated.variables || [],
      },
    });

    console.log("Template created successfully:", template.templateId);
    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.errors);
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating email template:", error);
    return NextResponse.json(
      { error: "Failed to create email template" },
      { status: 500 }
    );
  }
}