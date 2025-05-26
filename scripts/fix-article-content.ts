import { prisma } from "../src/lib/prisma";

async function fixArticleContent() {
  try {
    const articles = await prisma.article.findMany({
      where: {
        isContentGenerated: true,
        NOT: {
          contentHtml: null
        }
      }
    });

    console.log(`Found ${articles.length} articles to check\n`);

    for (const article of articles) {
      let content = article.contentHtml || '';
      let needsUpdate = false;
      
      // Fix content wrapped in ```markdown blocks
      if (content.startsWith('```markdown\n') && content.endsWith('\n```')) {
        content = content.slice(12, -4).trim();
        needsUpdate = true;
        console.log(`✅ Fixed markdown wrapper for: ${article.articleTitle}`);
      }
      // Fix content wrapped in ```html blocks
      else if (content.startsWith('```html\n') && content.endsWith('\n```')) {
        // For HTML content, we'll need to regenerate as markdown
        console.log(`❌ Found HTML content for: ${article.articleTitle} - needs regeneration`);
        
        // Mark as not generated so it gets regenerated
        await prisma.article.update({
          where: { articleId: article.articleId },
          data: { 
            isContentGenerated: false,
            contentHtml: null
          }
        });
        console.log(`   Marked for regeneration`);
        continue;
      }
      
      if (needsUpdate) {
        await prisma.article.update({
          where: { articleId: article.articleId },
          data: { contentHtml: content }
        });
      }
    }

    console.log("\nContent fix complete!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixArticleContent();