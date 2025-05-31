import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserFeatureAccess } from "@/lib/feature-access";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userAccess = await getUserFeatureAccess(userId);

    if (!userAccess) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Convert Map to plain object for JSON serialization
    const featuresObject: Record<string, any> = {};
    userAccess.features.forEach((value, key) => {
      featuresObject[key] = value;
    });

    return NextResponse.json({
      userId: userAccess.userId,
      tier: userAccess.tier,
      isActive: userAccess.isActive,
      features: featuresObject,
    });
  } catch (error) {
    console.error("Error fetching user features:", error);
    return NextResponse.json(
      { error: "Failed to fetch user features" },
      { status: 500 }
    );
  }
}