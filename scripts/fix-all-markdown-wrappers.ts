import { prisma } from "../src/lib/prisma";

async function fixAllMarkdownWrappers() {
  try {
    const articles = await prisma.article.findMany({
      where: {
        isContentGenerated: true,
        NOT: {
          contentHtml: null
        }
      }
    });

    console.log(`Checking ${articles.length} articles...\n`);

    let fixed = 0;
    
    for (const article of articles) {
      const content = article.contentHtml || '';
      
      // Check if content is wrapped in ```markdown or ```
      if (content.startsWith('```')) {
        const lines = content.split('\n');
        const firstLine = lines[0];
        const lastLine = lines[lines.length - 1].trim();
        
        if (lastLine === '```') {
          // Remove wrapper
          let cleanContent: string;
          
          if (firstLine === '```markdown' || firstLine === '```md') {
            cleanContent = lines.slice(1, -1).join('\n').trim();
          } else if (firstLine === '```') {
            cleanContent = lines.slice(1, -1).join('\n').trim();
          } else {
            // Skip if it's some other code block type
            continue;
          }
          
          await prisma.article.update({
            where: { articleId: article.articleId },
            data: { contentHtml: cleanContent }
          });
          
          console.log(`✅ Fixed: ${article.articleTitle}`);
          fixed++;
        }
      }
    }

    console.log(`\n✨ Fixed ${fixed} articles!`);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllMarkdownWrappers();