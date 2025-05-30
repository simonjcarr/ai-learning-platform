import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const authUser = await requireMinRole(Role.ADMIN);
    const { userId } = await params;
    const { role } = await req.json();

    // Validate role
    if (!Object.values(Role).includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    // Prevent self-demotion
    if (authUser.clerkUserId === userId && role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "Cannot change your own role from admin" },
        { status: 400 }
      );
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { clerkUserId: userId },
      data: { role },
      select: {
        clerkUserId: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json({
      message: "Role updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return NextResponse.json(
          { error: "Forbidden: Admin access required" },
          { status: 403 }
        );
      }
      if (error.message.includes("Record to update not found")) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}