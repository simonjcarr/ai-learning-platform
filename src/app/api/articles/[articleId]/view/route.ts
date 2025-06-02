import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkFeatureAccessWithAdmin } from "@/lib/feature-access-admin";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ articleId: string }> }
) {
  try {
    const { userId } = await auth();
    const { articleId } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check feature access for viewing articles (admins bypass all restrictions)
    const viewAccess = await checkFeatureAccessWithAdmin('view_articles', userId);
    
    if (!viewAccess.hasAccess) {
      return NextResponse.json(
        { error: viewAccess.reason || "Subscription required to view articles" },
        { status: 403 }
      );
    }

    // Check if article exists
    const article = await prisma.article.findUnique({
      where: { articleId }
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Ensure user exists in the database first
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId }
    });

    if (!user) {
      console.error(`User not found in database: ${userId}`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Upsert the article view - update viewedAt if user has already viewed this article
    const view = await prisma.userArticleView.upsert({
      where: {
        clerkUserId_articleId: {
          clerkUserId: userId,
          articleId: articleId
        }
      },
      update: {
        viewedAt: new Date()
      },
      create: {
        clerkUserId: userId,
        articleId: articleId
      }
    });

    // Check if this article is part of any course the user is enrolled in
    const courseArticle = await prisma.courseArticle.findFirst({
      where: { 
        articleId: articleId,
        section: {
          course: {
            enrollments: {
              some: {
                userId: user.userId,
              },
            },
          },
        },
      },
      include: {
        section: {
          include: {
            course: {
              include: {
                enrollments: {
                  where: {
                    userId: user.userId,
                  },
                },
              },
            },
          },
        },
      },
    });

    let courseProgressUpdated = false;
    
    if (courseArticle && courseArticle.section.course.enrollments.length > 0) {
      const enrollment = courseArticle.section.course.enrollments[0];
      
      // Update course progress - mark as visited if not already completed
      const existingProgress = await prisma.courseProgress.findUnique({
        where: {
          enrollmentId_articleId: {
            enrollmentId: enrollment.enrollmentId,
            articleId: articleId,
          },
        },
      });

      if (!existingProgress?.isCompleted) {
        await prisma.courseProgress.upsert({
          where: {
            enrollmentId_articleId: {
              enrollmentId: enrollment.enrollmentId,
              articleId: articleId,
            },
          },
          update: {
            timeSpent: { increment: 1 }, // Increment by 1 minute for each view
            updatedAt: new Date(),
          },
          create: {
            enrollmentId: enrollment.enrollmentId,
            articleId: articleId,
            isCompleted: false,
            timeSpent: 1,
          },
        });
        
        courseProgressUpdated = true;
      }
    }

    console.log(`Article view tracked: User ${userId} viewed article ${articleId}${courseProgressUpdated ? ' (course progress updated)' : ''}`);

    return NextResponse.json({ 
      success: true,
      courseProgressUpdated,
    });
  } catch (error) {
    console.error("Article view tracking error:", error);
    return NextResponse.json(
      { error: "Failed to track article view" },
      { status: 500 }
    );
  }
}