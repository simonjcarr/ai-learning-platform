import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await requireMinRole(Role.ADMIN);
    
    const pricing = await prisma.subscriptionPricing.findMany({
      orderBy: { tier: "asc" },
    });
    
    return NextResponse.json({ pricing });
  } catch (error) {
    console.error("Error fetching pricing:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireMinRole(Role.ADMIN);
    
    const body = await request.json();
    const { tier, stripePriceId, monthlyPriceCents, yearlyPriceCents, features, isActive } = body;
    
    const pricing = await prisma.subscriptionPricing.create({
      data: {
        tier,
        stripePriceId,
        monthlyPriceCents,
        yearlyPriceCents,
        features,
        isActive,
      },
    });
    
    return NextResponse.json({ pricing });
  } catch (error) {
    console.error("Error creating pricing:", error);
    return NextResponse.json(
      { error: "Failed to create pricing" },
      { status: 500 }
    );
  }
}