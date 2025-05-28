import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emails } from "@/lib/email-service";

export async function POST(
  request: NextRequest,
  { params }: { params: { articleId: string } }
) {
  try {
    const authUser = await requireAuth();
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
        flaggedByClerkUserId: authUser.clerkUserId,
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