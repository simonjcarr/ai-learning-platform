import { prisma } from '../src/lib/prisma';

async function updateSuggestionModel() {
  try {
    // Find an OpenAI model to use for suggestions
    const openaiModel = await prisma.aIModel.findFirst({
      where: { 
        isActive: true, 
        provider: 'openai',
        modelName: 'gpt-4o-mini' // Use the mini model for cost efficiency
      }
    });

    if (!openaiModel) {
      console.log('❌ No active OpenAI model found');
      return;
    }

    console.log('✅ Found OpenAI model:', openaiModel.displayName);

    // Update the interaction type
    const updated = await prisma.aIInteractionType.update({
      where: { typeName: 'article_suggestion_validation' },
      data: { defaultModelId: openaiModel.modelId }
    });

    console.log('✅ Updated article_suggestion_validation to use:', openaiModel.displayName);

  } catch (error) {
    console.error('Error updating suggestion model:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateSuggestionModel();