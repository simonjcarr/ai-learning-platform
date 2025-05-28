import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.AI_API_KEY_ENCRYPTION_KEY || 'default-key-for-development-only';

function decryptApiKey(encryptedApiKey: string): string {
  if (!encryptedApiKey) return '';
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const parts = encryptedApiKey.split(':');
    if (parts.length !== 2) {
      console.log('Invalid encrypted key format (missing colon separator)');
      return '';
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return '';
  }
}

async function checkAIKeys() {
  try {
    const models = await prisma.aIModel.findMany({
      where: { isActive: true },
      select: {
        modelId: true,
        displayName: true,
        provider: true,
        modelName: true,
        apiKey: true
      }
    });

    console.log('Checking AI Model API Keys:');
    console.log('============================\n');

    for (const model of models) {
      console.log(`Model: ${model.displayName}`);
      console.log(`Provider: ${model.provider}`);
      console.log(`Model Name: ${model.modelName}`);
      
      if (!model.apiKey) {
        console.log('❌ No API key stored');
      } else {
        // Check if it looks encrypted (has colon separator)
        if (model.apiKey.includes(':')) {
          const decrypted = decryptApiKey(model.apiKey);
          if (decrypted) {
            console.log(`✅ API key is encrypted and can be decrypted`);
            console.log(`   Key preview: ${decrypted.substring(0, 10)}...${decrypted.substring(decrypted.length - 4)}`);
          } else {
            console.log('❌ API key is encrypted but cannot be decrypted');
          }
        } else {
          console.log('⚠️  API key appears to be stored in plain text');
          console.log(`   Key preview: ${model.apiKey.substring(0, 10)}...${model.apiKey.substring(model.apiKey.length - 4)}`);
        }
      }
      console.log('---\n');
    }

    // Check the suggestion validation interaction type
    const interactionType = await prisma.aIInteractionType.findUnique({
      where: { typeName: 'article_suggestion_validation' },
      include: { defaultModel: true }
    });

    if (interactionType && interactionType.defaultModel) {
      console.log('Article Suggestion Validation Configuration:');
      console.log(`Using model: ${interactionType.defaultModel.displayName}`);
      console.log(`Provider: ${interactionType.defaultModel.provider}`);
    }

  } catch (error) {
    console.error('Error checking AI keys:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAIKeys();