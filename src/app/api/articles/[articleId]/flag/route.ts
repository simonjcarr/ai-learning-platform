import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { emails } from "@/lib/email-service";
import { checkFeatureAccessWithAdmin } from "@/lib/feature-access-admin";

export async function POST(
  request: NextRequest,
  { params }: { params: { articleId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check feature access (admins bypass all restrictions)
    const flagAccess = await checkFeatureAccessWithAdmin('flag_content', userId);
    
    if (!flagAccess.hasAccess) {
      return NextResponse.json(
        { error: flagAccess.reason || 'Subscription required to flag content' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { flagReason } = body;

    if (!flagReason || !flagReason.trim()) {
      return NextResponse.json(
        { error: "Flag reason is required" },
        { status: 400 }
      );
    }

    const article = await prisma.article.update({
      where: { articleId: params.articleId },
      data: {
        isFlagged: true,
        flaggedAt: new Date(),
        flaggedByClerkUserId: userId,
        flagReason: flagReason.trim(),
      },
      include: {
        flaggedBy: {
          select: { firstName: true, lastName: true, username: true }
        }
      }
    });

    // Send notification to admins and moderators
    try {
      const adminUsers = await prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'MODERATOR'] }
        },
        select: { email: true }
      });

      if (adminUsers.length > 0) {
        const adminEmails = adminUsers.map(user => user.email);
        const flaggedBy = article.flaggedBy?.firstName || article.flaggedBy?.username || "User";
        
        await emails.sendArticleFlaggedNotification(
          adminEmails,
          article.articleTitle,
          flaggedBy,
          flagReason.trim()
        );
        console.log(`Article flagged notification sent to ${adminEmails.length} admins/moderators`);
      }
    } catch (emailError) {
      console.error(`Failed to send article flagged notification:`, emailError);
      // Don't fail the flagging if email fails
    }

    return NextResponse.json({ success: true, article });
  } catch (error) {
    console.error("Error flagging article:", error);
    return NextResponse.json(
      { error: "Failed to flag article" },
      { status: 500 }
    );
  }
}