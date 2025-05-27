import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function debugArticleViews() {
  try {
    // Get all user article views
    const allViews = await prisma.userArticleView.findMany({
      include: {
        user: {
          select: {
            clerkUserId: true,
            email: true
          }
        },
        article: {
          select: {
            articleId: true,
            articleTitle: true
          }
        }
      }
    });

    console.log(`Total article views: ${allViews.length}`);
    console.log("\nArticle views by user:");
    
    const viewsByUser = allViews.reduce((acc, view) => {
      const userId = view.user.clerkUserId;
      if (!acc[userId]) {
        acc[userId] = {
          email: view.user.email,
          views: []
        };
      }
      acc[userId].views.push({
        articleTitle: view.article.articleTitle,
        viewedAt: view.viewedAt
      });
      return acc;
    }, {} as Record<string, { email: string; views: Array<{ articleTitle: string; viewedAt: Date }> }>);

    for (const [userId, data] of Object.entries(viewsByUser)) {
      console.log(`\nUser: ${data.email} (${userId})`);
      console.log(`Total views: ${data.views.length}`);
      data.views.forEach(view => {
        console.log(`  - ${view.articleTitle} (viewed: ${view.viewedAt.toLocaleString()})`);
      });
    }

    // Also check for any user responses
    const allResponses = await prisma.userResponse.findMany({
      include: {
        user: {
          select: {
            clerkUserId: true,
            email: true
          }
        },
        example: {
          include: {
            article: {
              select: {
                articleTitle: true
              }
            }
          }
        }
      }
    });

    console.log(`\n\nTotal quiz responses: ${allResponses.length}`);
    
    const responsesByUser = allResponses.reduce((acc, response) => {
      const userId = response.user.clerkUserId;
      if (!acc[userId]) {
        acc[userId] = {
          email: response.user.email,
          articles: new Set<string>()
        };
      }
      acc[userId].articles.add(response.example.article.articleTitle);
      return acc;
    }, {} as Record<string, { email: string; articles: Set<string> }>);

    for (const [userId, data] of Object.entries(responsesByUser)) {
      console.log(`\nUser: ${data.email} (${userId})`);
      console.log(`Articles with quiz responses: ${data.articles.size}`);
      Array.from(data.articles).forEach(title => {
        console.log(`  - ${title}`);
      });
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugArticleViews();