import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { pricingId: string } }
) {
  try {
    await requireMinRole(Role.ADMIN);
    
    const body = await request.json();
    
    const pricing = await prisma.subscriptionPricing.update({
      where: { pricingId: params.pricingId },
      data: body,
    });
    
    return NextResponse.json({ pricing });
  } catch (error) {
    console.error("Error updating pricing:", error);
    return NextResponse.json(
      { error: "Failed to update pricing" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { pricingId: string } }
) {
  try {
    await requireMinRole(Role.ADMIN);
    
    await prisma.subscriptionPricing.delete({
      where: { pricingId: params.pricingId },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pricing:", error);
    return NextResponse.json(
      { error: "Failed to delete pricing" },
      { status: 500 }
    );
  }
}