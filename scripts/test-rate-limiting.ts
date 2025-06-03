import { rateLimitManager } from '../src/lib/rate-limit';

async function testRateLimiting() {
  console.log('🧪 Testing Rate Limiting System');
  
  // Test error detection
  console.log('\n1. Testing error pattern detection:');
  
  const testErrors = [
    { message: 'Rate limit exceeded', provider: 'openai', expected: true },
    { message: 'Too many requests', provider: 'anthropic', expected: true },
    { message: 'quota exceeded', provider: 'google', expected: true },
    { message: 'Network timeout', provider: 'openai', expected: false },
    { status: 429, provider: 'openai', expected: true },
    { status: 503, provider: 'anthropic', expected: true },
    { status: 200, provider: 'google', expected: false },
  ];
  
  for (const error of testErrors) {
    const isRateLimit = rateLimitManager.isRateLimitError(error, error.provider);
    const result = isRateLimit === error.expected ? '✅' : '❌';
    console.log(`${result} ${error.provider}: "${error.message || `Status ${error.status}`}" -> ${isRateLimit}`);
  }
  
  // Test rate limit setting and checking
  console.log('\n2. Testing rate limit management:');
  
  const testProvider = 'test-provider';
  const testModelId = 'test-model';
  
  // Check initial state (should be no rate limit)
  let rateLimitInfo = await rateLimitManager.checkRateLimit(testProvider, testModelId);
  console.log(`Initial state: ${rateLimitInfo.isRateLimited ? '❌ Rate limited' : '✅ Not rate limited'}`);
  
  // Set a rate limit
  await rateLimitManager.setRateLimit(testProvider, testModelId, 5); // 5 second timeout
  console.log('✅ Rate limit set for 5 seconds');
  
  // Check rate limit is active
  rateLimitInfo = await rateLimitManager.checkRateLimit(testProvider, testModelId);
  console.log(`After setting: ${rateLimitInfo.isRateLimited ? '✅ Rate limited' : '❌ Not rate limited'}`);
  if (rateLimitInfo.isRateLimited) {
    console.log(`   Seconds remaining: ${rateLimitInfo.secondsRemaining}`);
  }
  
  // Wait 2 seconds and check again
  console.log('⏳ Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  rateLimitInfo = await rateLimitManager.checkRateLimit(testProvider, testModelId);
  console.log(`After 2s: ${rateLimitInfo.isRateLimited ? '✅ Still rate limited' : '❌ No longer rate limited'}`);
  if (rateLimitInfo.isRateLimited) {
    console.log(`   Seconds remaining: ${rateLimitInfo.secondsRemaining}`);
  }
  
  // Clear the rate limit
  await rateLimitManager.clearRateLimit(testProvider, testModelId);
  console.log('✅ Rate limit cleared');
  
  // Check it's cleared
  rateLimitInfo = await rateLimitManager.checkRateLimit(testProvider, testModelId);
  console.log(`After clearing: ${rateLimitInfo.isRateLimited ? '❌ Still rate limited' : '✅ Not rate limited'}`);
  
  // Test retry-after extraction
  console.log('\n3. Testing retry-after extraction:');
  
  const testRetryErrors = [
    { headers: { 'retry-after': '60' }, expected: 60 },
    { message: 'retry in 30 seconds', expected: 30 },
    { message: 'try again after 120', expected: 120 },
    { message: 'no retry info', expected: undefined },
  ];
  
  for (const error of testRetryErrors) {
    const retryAfter = rateLimitManager.extractRetryAfter(error);
    const result = retryAfter === error.expected ? '✅' : '❌';
    console.log(`${result} "${error.message || 'Header: ' + error.headers?.['retry-after']}" -> ${retryAfter}`);
  }
  
  console.log('\n🎉 Rate limiting test completed!');
}

// Run the test
testRateLimiting().catch(console.error);