import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { emails } from "@/lib/email-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await params;
  
  try {
    const comments = await prisma.comment.findMany({
      where: { 
        articleId,
        parentId: null // Only get top-level comments
      },
      include: {
        user: {
          select: {
            clerkUserId: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          }
        },
        replies: {
          include: {
            user: {
              select: {
                clerkUserId: true,
                username: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
              }
            },
            replies: {
              include: {
                user: {
                  select: {
                    clerkUserId: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    imageUrl: true,
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await params;
  
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content, parentId } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    // Check if user exists in our database
    let dbUser = await prisma.user.findUnique({
      where: { clerkUserId: user.id }
    });

    // Determine the best username to use
    const baseUsername = user.username || user.firstName || user.lastName || 
                        user.emailAddresses[0]?.emailAddress?.split('@')[0] || null;

    if (!dbUser) {
      // Create user if they don't exist
      let username = baseUsername;
      
      // If username is taken, append a number
      if (username) {
        let counter = 1;
        while (await prisma.user.findUnique({ where: { username } })) {
          username = `${baseUsername}${counter}`;
          counter++;
        }
      }
      
      dbUser = await prisma.user.create({
        data: {
          clerkUserId: user.id,
          email: user.emailAddresses[0]?.emailAddress || '',
          username,
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          imageUrl: user.imageUrl || null,
        }
      });
    } else if (!dbUser.username) {
      // Update username if it's missing
      let username = baseUsername;
      
      // If username is taken, append a number
      if (username) {
        let counter = 1;
        while (await prisma.user.findUnique({ where: { username } })) {
          username = `${baseUsername}${counter}`;
          counter++;
        }
        
        dbUser = await prisma.user.update({
          where: { clerkUserId: user.id },
          data: { username }
        });
      }
    }
    
    // Always update user info to keep it in sync with Clerk
    if (dbUser.firstName !== user.firstName || 
        dbUser.lastName !== user.lastName || 
        dbUser.imageUrl !== user.imageUrl) {
      dbUser = await prisma.user.update({
        where: { clerkUserId: user.id },
        data: {
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          imageUrl: user.imageUrl || null,
        }
      });
    }

    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        articleId,
        clerkUserId: user.id,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: {
        user: {
          select: {
            clerkUserId: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          }
        }
      }
    });

    // Send notification emails asynchronously
    try {
      if (parentId) {
        // This is a reply to another comment - notify the parent comment author
        const parentComment = await prisma.comment.findUnique({
          where: { commentId: parentId },
          include: { 
            user: { select: { email: true, firstName: true } },
            article: { select: { articleTitle: true, articleSlug: true } }
          }
        });

        if (parentComment && parentComment.user.email !== user.emailAddresses[0]?.emailAddress) {
          const commenterName = dbUser.firstName || dbUser.username || "Someone";
          await emails.sendCommentNotification(
            parentComment.user.email,
            commenterName,
            parentComment.article.articleTitle,
            parentComment.article.articleSlug,
            content.trim()
          );
        }
      } else {
        // This is a top-level comment - notify article author and users who liked the article
        const article = await prisma.article.findUnique({
          where: { articleId },
          include: { 
            createdBy: { select: { email: true, firstName: true } },
            likes: { 
              include: { user: { select: { email: true, firstName: true } } }
            }
          }
        });

        if (article) {
          const commenterName = dbUser.firstName || dbUser.username || "Someone";
          const notificationEmails = new Set<string>();
          
          // Add article author
          if (article.createdBy && article.createdBy.email !== user.emailAddresses[0]?.emailAddress) {
            notificationEmails.add(article.createdBy.email);
          }
          
          // Add users who liked the article
          article.likes.forEach(like => {
            if (like.user.email !== user.emailAddresses[0]?.emailAddress) {
              notificationEmails.add(like.user.email);
            }
          });

          // Send notifications
          for (const email of notificationEmails) {
            await emails.sendCommentNotification(
              email,
              commenterName,
              article.articleTitle,
              article.articleSlug,
              content.trim()
            );
          }
        }
      }
    } catch (emailError) {
      console.error("Failed to send comment notification:", emailError);
      // Don't fail the comment creation if email fails
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}