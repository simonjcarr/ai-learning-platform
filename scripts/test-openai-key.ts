import { prisma } from '../src/lib/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.AI_API_KEY_ENCRYPTION_KEY || 'default-key-for-development-only';

function decryptApiKey(encryptedApiKey: string): string {
  if (!encryptedApiKey) return '';
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const parts = encryptedApiKey.split(':');
    if (parts.length !== 2) return '';
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

async function testOpenAIKey() {
  try {
    // Get the GPT-4o Mini model
    const model = await prisma.aIModel.findFirst({
      where: { 
        isActive: true, 
        provider: 'openai',
        modelName: 'gpt-4o-mini'
      }
    });

    if (!model) {
      console.log('❌ GPT-4o Mini model not found');
      return;
    }

    console.log('Testing OpenAI API key for:', model.displayName);
    
    const apiKey = decryptApiKey(model.apiKey);
    if (!apiKey) {
      console.log('❌ Failed to decrypt API key');
      return;
    }

    console.log('✅ API key decrypted successfully');
    console.log(`Key format check: ${apiKey.startsWith('sk-') ? '✅ Starts with sk-' : '❌ Invalid format'}`);
    console.log(`Key length: ${apiKey.length} characters`);

    // Try to use the API key with the AI SDK
    try {
      console.log('\nTesting API key with AI SDK...');
      const openai = createOpenAI({ apiKey });
      const aiModel = openai(model.modelName);
      
      const result = await generateText({
        model: aiModel,
        prompt: 'Say "Hello, the API key works!"',
        temperature: 0,
        maxTokens: 20,
      });

      console.log('✅ API key is valid and working!');
      console.log('Response:', result.text);
    } catch (error: any) {
      console.log('❌ API key test failed:', error.message);
      if (error.status === 401) {
        console.log('   The API key is invalid or has been revoked');
      }
    }

  } catch (error) {
    console.error('Error testing OpenAI key:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testOpenAIKey();