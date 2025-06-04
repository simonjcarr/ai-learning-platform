import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkFeatureAccess } from "@/lib/feature-access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureKey: string }> }
) {
  try {
    const { userId } = await auth();
    const { featureKey } = await params;

    if (!userId) {
      // For non-authenticated users, return no access instead of 401
      // This allows FeatureGuard to show upgrade prompts instead of errors
      return NextResponse.json({ 
        access: { 
          hasAccess: false, 
          reason: "Authentication required" 
        } 
      });
    }

    const access = await checkFeatureAccess(featureKey, userId);

    return NextResponse.json({ access });
  } catch (error) {
    console.error("Error checking feature access:", error);
    return NextResponse.json(
      { error: "Failed to check feature access" },
      { status: 500 }
    );
  }
}