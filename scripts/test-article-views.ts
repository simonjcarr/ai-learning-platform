import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testArticleViews() {
  try {
    // Get a user and some articles to test with
    const user = await prisma.user.findFirst({
      where: {
        email: "simonjcarr@gmail.com"
      }
    });

    if (!user) {
      console.log("User not found");
      return;
    }

    console.log(`Found user: ${user.email} (${user.clerkUserId})`);

    // Get some articles
    const articles = await prisma.article.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${articles.length} articles`);

    // Create article views for testing
    for (const article of articles) {
      const view = await prisma.userArticleView.upsert({
        where: {
          clerkUserId_articleId: {
            clerkUserId: user.clerkUserId,
            articleId: article.articleId
          }
        },
        update: {
          viewedAt: new Date()
        },
        create: {
          clerkUserId: user.clerkUserId,
          articleId: article.articleId
        }
      });
      console.log(`Created/updated view for article: ${article.articleTitle}`);
    }

    // Verify the views were created
    const viewCount = await prisma.userArticleView.count({
      where: { clerkUserId: user.clerkUserId }
    });

    console.log(`\nTotal views for user: ${viewCount}`);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testArticleViews();