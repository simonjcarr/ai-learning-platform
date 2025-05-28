import { prisma } from '../src/lib/prisma';

async function checkArticleSize() {
  try {
    const article = await prisma.article.findUnique({
      where: { articleId: 'cmb7p5xhh007fslwvi4baaobe' },
      select: {
        articleTitle: true,
        contentHtml: true
      }
    });

    if (article) {
      console.log('Article:', article.articleTitle);
      console.log('Content length:', article.contentHtml?.length || 0, 'characters');
      console.log('Approximate tokens:', Math.ceil((article.contentHtml?.length || 0) / 4), 'tokens');
      
      // Check if it's too large
      if (article.contentHtml && article.contentHtml.length > 10000) {
        console.log('\n⚠️  This article is quite large and may take a long time to process with AI');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkArticleSize();