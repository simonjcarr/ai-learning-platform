import { prisma } from "../src/lib/prisma";

async function checkArticleContent() {
  try {
    // Get all articles with content
    const articles = await prisma.article.findMany({
      where: {
        isContentGenerated: true,
        NOT: {
          contentHtml: null
        }
      },
      select: {
        articleTitle: true,
        contentHtml: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    console.log(`Found ${articles.length} articles with generated content\n`);

    for (const article of articles) {
      console.log(`Title: ${article.articleTitle}`);
      console.log(`Updated: ${article.updatedAt}`);
      
      const content = article.contentHtml || '';
      const first100 = content.substring(0, 100);
      
      if (content.startsWith('```html')) {
        console.log("Format: ❌ HTML wrapped in code blocks");
      } else if (content.startsWith('<!DOCTYPE') || content.startsWith('<html')) {
        console.log("Format: ❌ Raw HTML");
      } else if (content.startsWith('#') || content.includes('\n##')) {
        console.log("Format: ✅ Markdown");
      } else {
        console.log("Format: ❓ Unknown");
      }
      
      console.log(`Preview: ${first100}...`);
      console.log('---\n');
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkArticleContent();