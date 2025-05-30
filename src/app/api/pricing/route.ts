import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const pricing = await prisma.subscriptionPricing.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: {
        pricingId: true,
        tier: true,
        stripePriceId: true,
        monthlyPriceCents: true,
        yearlyPriceCents: true,
        features: true,
        isActive: true,
        freeTrialDays: true,
        displayOrder: true,
      },
    });
    
    return NextResponse.json({ pricing });
  } catch (error) {
    console.error("Error fetching public pricing:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing" },
      { status: 500 }
    );
  }
}