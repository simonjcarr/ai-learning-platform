import { prisma } from "../src/lib/prisma";

async function debugArticleContent() {
  try {
    // Find the LVM RAID Configuration article
    const article = await prisma.article.findFirst({
      where: {
        articleTitle: "LVM RAID Configuration"
      }
    });

    if (!article) {
      console.log("Article not found");
      return;
    }

    console.log("Article Title:", article.articleTitle);
    console.log("Is Content Generated:", article.isContentGenerated);
    console.log("Content length:", article.contentHtml?.length || 0);
    
    if (article.contentHtml) {
      // Show first 1000 characters
      console.log("\nContent preview:");
      console.log(article.contentHtml.substring(0, 1000));
      
      // Check content format
      const content = article.contentHtml;
      
      console.log("\n\nContent analysis:");
      console.log("Starts with '```':", content.startsWith('```'));
      console.log("Starts with '# ':", content.startsWith('# '));
      console.log("Contains '\\n##':", content.includes('\n##'));
      
      // Extract content if wrapped in code blocks
      if (content.startsWith('```')) {
        const lines = content.split('\n');
        const firstLine = lines[0];
        const lastLine = lines[lines.length - 1];
        
        console.log("\nFirst line:", firstLine);
        console.log("Last line:", lastLine);
        
        if (lastLine === '```') {
          // Remove first and last line
          const cleanContent = lines.slice(1, -1).join('\n');
          console.log("\nCleaned content preview:");
          console.log(cleanContent.substring(0, 200));
          
          // Update the article
          console.log("\nUpdating article...");
          await prisma.article.update({
            where: { articleId: article.articleId },
            data: { contentHtml: cleanContent }
          });
          console.log("Article updated!");
        }
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugArticleContent();