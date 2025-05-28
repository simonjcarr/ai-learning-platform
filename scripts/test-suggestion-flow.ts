import { prisma } from '../src/lib/prisma';

async function testSuggestionFlow() {
  try {
    // Check if we have an AI model configured for suggestion validation
    const interactionType = await prisma.aIInteractionType.findUnique({
      where: { typeName: 'article_suggestion_validation' },
      include: { defaultModel: true }
    });

    if (!interactionType) {
      console.log('❌ No interaction type found for article_suggestion_validation');
      console.log('Creating interaction type...');
      
      const defaultModel = await prisma.aIModel.findFirst({
        where: { isActive: true, provider: 'openai' }
      });

      if (!defaultModel) {
        console.log('❌ No active OpenAI model found. Please configure an AI model first.');
        return;
      }

      await prisma.aIInteractionType.create({
        data: {
          typeName: 'article_suggestion_validation',
          displayName: 'Article Suggestion Validation',
          description: 'Validates and applies user suggestions to articles',
          defaultModelId: defaultModel.modelId
        }
      });

      console.log('✅ Created article_suggestion_validation interaction type');
    } else {
      console.log('✅ Found interaction type:', interactionType.displayName);
      console.log('  - Default model:', interactionType.defaultModel?.displayName || 'None');
    }

    // Check for a test article
    const testArticle = await prisma.article.findFirst({
      where: { isContentGenerated: true },
      select: {
        articleId: true,
        articleTitle: true,
        contentHtml: true
      }
    });

    if (testArticle) {
      console.log('\n📄 Test article found:');
      console.log('  - ID:', testArticle.articleId);
      console.log('  - Title:', testArticle.articleTitle);
      console.log('  - Content length:', testArticle.contentHtml?.length || 0, 'characters');
    } else {
      console.log('\n❌ No articles with generated content found');
    }

    console.log('\n✅ Suggestion flow is ready for testing!');
    console.log('\nTo test:');
    console.log('1. Make sure you have an active OpenAI API key configured');
    console.log('2. Visit an article page');
    console.log('3. Click "Suggest Improvement"');
    console.log('4. Submit a suggestion and watch for AI validation');

  } catch (error) {
    console.error('Error testing suggestion flow:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSuggestionFlow();