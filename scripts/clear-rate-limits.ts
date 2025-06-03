import { rateLimitManager } from '../src/lib/rate-limit';
import { prisma } from '../src/lib/prisma';

async function clearAllRateLimits() {
  console.log('🧹 Clearing all rate limits...');
  
  try {
    // Clear all active rate limits from Redis
    const activeRateLimits = await rateLimitManager.getActiveRateLimits();
    console.log(`📊 Found ${activeRateLimits.length} active rate limits in Redis`);
    
    for (const rateLimit of activeRateLimits) {
      if (rateLimit.provider && rateLimit.modelId) {
        await rateLimitManager.clearRateLimit(rateLimit.provider, rateLimit.modelId);
        console.log(`✅ Cleared Redis rate limit for ${rateLimit.provider}:${rateLimit.modelId}`);
      }
    }
    
    // Update database rate limits to inactive
    const dbRateLimits = await prisma.aIRateLimit.findMany({
      where: { isActive: true }
    });
    
    console.log(`💾 Found ${dbRateLimits.length} active rate limits in database`);
    
    for (const rateLimit of dbRateLimits) {
      await prisma.aIRateLimit.update({
        where: { rateLimitId: rateLimit.rateLimitId },
        data: {
          isActive: false,
          clearedAt: new Date(),
        }
      });
      console.log(`✅ Cleared database rate limit for ${rateLimit.provider}:${rateLimit.modelId}`);
    }
    
    console.log('🎉 All rate limits cleared!');
    console.log('');
    console.log('📝 Summary:');
    console.log(`   - Cleared ${activeRateLimits.length} Redis rate limits`);
    console.log(`   - Cleared ${dbRateLimits.length} database rate limits`);
    console.log('');
    console.log('🚀 You can now test course generation without rate limit interference');
    
  } catch (error) {
    console.error('❌ Error clearing rate limits:', error);
  }
}

// Run the cleanup
clearAllRateLimits().catch(console.error);