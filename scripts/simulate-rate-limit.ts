import { rateLimitManager } from '../src/lib/rate-limit';
import { prisma } from '../src/lib/prisma';

async function simulateRateLimit() {
  console.log('🔧 Simulating Rate Limit for Testing');
  
  try {
    // Get the first active AI model
    const model = await prisma.aIModel.findFirst({
      where: { isActive: true }
    });
    
    if (!model) {
      console.log('❌ No active AI models found');
      return;
    }
    
    console.log(`📍 Found model: ${model.displayName} (${model.provider}:${model.modelId})`);
    
    // Set a rate limit for this model
    console.log('🚫 Setting rate limit for 60 seconds...');
    await rateLimitManager.setRateLimit(model.provider, model.modelId, 60);
    
    const rateLimitInfo = await rateLimitManager.checkRateLimit(model.provider, model.modelId);
    console.log(`✅ Rate limit set: ${rateLimitInfo.isRateLimited ? 'Active' : 'Not active'}`);
    console.log(`   Seconds remaining: ${rateLimitInfo.secondsRemaining}`);
    
    // Record this in the database
    await prisma.aIRateLimit.create({
      data: {
        provider: model.provider,
        modelId: model.modelId,
        isActive: true,
        timeoutUntil: new Date(Date.now() + 60000), // 60 seconds from now
        hitCount: 1,
      }
    });
    
    console.log('📝 Rate limit recorded in database');
    console.log('');
    console.log('🎯 Now when course generation jobs run, they should:');
    console.log('   1. Check for rate limit before making AI calls');
    console.log('   2. Throw RateLimitError if rate limited');
    console.log('   3. BullMQ should use custom backoff strategy');
    console.log('   4. Jobs should retry after the rate limit expires');
    console.log('');
    console.log('📊 To check active rate limits: GET /api/admin/ai-rate-limits');
    console.log('🧹 To clear this rate limit: DELETE /api/admin/ai-rate-limits?provider=' + model.provider + '&modelId=' + model.modelId);
    
  } catch (error) {
    console.error('❌ Error simulating rate limit:', error);
  }
}

// Run the simulation
simulateRateLimit().catch(console.error);