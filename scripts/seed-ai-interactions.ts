import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Same encryption function as in ai-service.ts
const ENCRYPTION_KEY = process.env.AI_API_KEY_ENCRYPTION_KEY || 'default-key-for-development-only';

function encryptApiKey(apiKey: string): string {
  if (!apiKey) return '';
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function seedAIInteractions() {
  console.log('🌱 Seeding comprehensive AI models and interaction types...');

  // Create default AI models
  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const models = [];

  // OpenAI models
  if (openaiKey) {
    const gpt4Turbo = await prisma.aIModel.upsert({
      where: { modelName: 'gpt-4-0125-preview' },
      update: {},
      create: {
        modelName: 'gpt-4-0125-preview',
        provider: 'openai',
        displayName: 'GPT-4 Turbo',
        description: 'Most capable OpenAI model, great for complex tasks',
        apiKey: encryptApiKey(openaiKey),
        inputTokenCostPer1M: 10.0,  // $10 per 1M input tokens
        outputTokenCostPer1M: 30.0, // $30 per 1M output tokens
        isDefault: true,
        isActive: true,
      }
    });
    models.push(gpt4Turbo);

    const gpt4o = await prisma.aIModel.upsert({
      where: { modelName: 'gpt-4o' },
      update: {},
      create: {
        modelName: 'gpt-4o',
        provider: 'openai',
        displayName: 'GPT-4o',
        description: 'Faster and cheaper GPT-4 variant',
        apiKey: encryptApiKey(openaiKey),
        inputTokenCostPer1M: 5.0,   // $5 per 1M input tokens
        outputTokenCostPer1M: 15.0, // $15 per 1M output tokens
        isDefault: false,
        isActive: true,
      }
    });
    models.push(gpt4o);

    const gpt4oMini = await prisma.aIModel.upsert({
      where: { modelName: 'gpt-4o-mini' },
      update: {},
      create: {
        modelName: 'gpt-4o-mini',
        provider: 'openai',
        displayName: 'GPT-4o Mini',
        description: 'Fast and cost-effective for simpler tasks',
        apiKey: encryptApiKey(openaiKey),
        inputTokenCostPer1M: 0.15,  // $0.15 per 1M input tokens
        outputTokenCostPer1M: 0.60, // $0.60 per 1M output tokens
        isDefault: false,
        isActive: true,
      }
    });
    models.push(gpt4oMini);
  }

  // Google models
  if (googleKey) {
    const geminiPro = await prisma.aIModel.upsert({
      where: { modelName: 'gemini-2.0-flash-exp' },
      update: {},
      create: {
        modelName: 'gemini-2.0-flash-exp',
        provider: 'google',
        displayName: 'Gemini 2.0 Flash',
        description: 'Google\'s fastest and most efficient model',
        apiKey: encryptApiKey(googleKey),
        inputTokenCostPer1M: 0.075,  // $0.075 per 1M input tokens
        outputTokenCostPer1M: 0.30,  // $0.30 per 1M output tokens
        isDefault: false,
        isActive: true,
      }
    });
    models.push(geminiPro);
  }

  // Anthropic models
  if (anthropicKey) {
    const claudeSonnet = await prisma.aIModel.upsert({
      where: { modelName: 'claude-3-5-sonnet-20241022' },
      update: {},
      create: {
        modelName: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        displayName: 'Claude 3.5 Sonnet',
        description: 'Anthropic\'s most balanced model',
        apiKey: encryptApiKey(anthropicKey),
        inputTokenCostPer1M: 3.0,   // $3 per 1M input tokens
        outputTokenCostPer1M: 15.0, // $15 per 1M output tokens
        isDefault: false,
        isActive: true,
      }
    });
    models.push(claudeSonnet);

    const claudeHaiku = await prisma.aIModel.upsert({
      where: { modelName: 'claude-3-5-haiku-20241022' },
      update: {},
      create: {
        modelName: 'claude-3-5-haiku-20241022',
        provider: 'anthropic',
        displayName: 'Claude 3.5 Haiku',
        description: 'Fast and cost-effective for quick tasks',
        apiKey: encryptApiKey(anthropicKey),
        inputTokenCostPer1M: 1.0,   // $1 per 1M input tokens
        outputTokenCostPer1M: 5.0,  // $5 per 1M output tokens
        isDefault: false,
        isActive: true,
      }
    });
    models.push(claudeHaiku);
  }

  console.log(`✅ Created ${models.length} AI models`);

  // Create comprehensive interaction types covering all app functionality
  const defaultModel = models.find(m => m.isDefault) || models[0];
  
  if (!defaultModel) {
    console.error('❌ No AI models available. Please set API keys in environment variables.');
    return;
  }

  const interactionTypes = [
    {
      typeName: 'search_suggestions',
      displayName: 'Search Suggestions',
      description: 'Generate article and category suggestions based on search queries',
    },
    {
      typeName: 'article_generation',
      displayName: 'Article Generation',
      description: 'Generate full article content with examples and best practices',
    },
    {
      typeName: 'interactive_examples',
      displayName: 'Interactive Examples',
      description: 'Generate quiz questions and interactive examples for articles',
    },
    {
      typeName: 'answer_marking',
      displayName: 'Answer Marking',
      description: 'Mark and provide feedback on user answers to interactive examples',
    },
    {
      typeName: 'keyword_extraction',
      displayName: 'Keyword Extraction',
      description: 'Extract keywords from search queries to improve search results',
    },
    {
      typeName: 'search_reordering',
      displayName: 'Search Reordering',
      description: 'Reorder search results by relevance to user query',
    },
    {
      typeName: 'tag_selection',
      displayName: 'Tag Selection',
      description: 'Select and create relevant tags for articles automatically',
    },
    {
      typeName: 'chat',
      displayName: 'Chat/Tutoring',
      description: 'AI chat and tutoring interactions to help users understand articles',
    },
    {
      typeName: 'article_suggestion_validation',
      displayName: 'Article Suggestion Validation',
      description: 'Validates and applies user suggestions for article improvements',
    },
  ];

  for (const typeData of interactionTypes) {
    await prisma.aIInteractionType.upsert({
      where: { typeName: typeData.typeName },
      update: {},
      create: {
        ...typeData,
        defaultModelId: defaultModel.modelId,
      }
    });
  }

  console.log(`✅ Created ${interactionTypes.length} interaction types`);
  console.log('🎉 Complete AI models and interaction types seeded successfully!');
  
  // Display summary of what was created
  console.log('\n📊 Summary of AI Interaction Types:');
  interactionTypes.forEach((type, index) => {
    console.log(`${index + 1}. ${type.displayName} (${type.typeName})`);
    console.log(`   → ${type.description}`);
  });
}

async function main() {
  try {
    await seedAIInteractions();
  } catch (error) {
    console.error('❌ Error seeding AI interactions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { seedAIInteractions };