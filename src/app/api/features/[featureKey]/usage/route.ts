import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkFeatureUsage } from "@/lib/feature-access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureKey: string }> }
) {
  try {
    const { userId } = await auth();
    const { featureKey } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const period = url.searchParams.get('period') as 'daily' | 'monthly' || 'daily';

    const usage = await checkFeatureUsage(featureKey, userId, period);

    return NextResponse.json({ usage });
  } catch (error) {
    console.error("Error checking feature usage:", error);
    return NextResponse.json(
      { error: "Failed to check feature usage" },
      { status: 500 }
    );
  }
}