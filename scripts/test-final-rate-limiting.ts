import { courseGenerationQueue } from '../src/lib/bullmq';
import { rateLimitManager } from '../src/lib/rate-limit';
import { prisma } from '../src/lib/prisma';

async function testRateLimitingIntegration() {
  console.log('🔧 Testing Complete Rate Limiting Integration');
  
  try {
    // 1. Create a test course
    const testCourse = await prisma.course.upsert({
      where: { slug: 'test-rate-limit-final' },
      update: {},
      create: {
        title: 'Final Rate Limit Test Course',
        description: 'Testing the complete rate limiting system',
        slug: 'test-rate-limit-final',
        level: 'BEGINNER',
        status: 'DRAFT',
        generationStatus: 'PENDING',
        systemPromptTitle: 'Final Test Course',
        systemPromptDescription: 'Complete rate limiting test',
      },
    });
    
    console.log(`✅ Test course created: ${testCourse.courseId}`);
    
    // 2. Get the AI model that will be used
    const model = await prisma.aIModel.findFirst({
      where: { isActive: true, isDefault: true }
    });
    
    if (!model) {
      console.log('❌ No default AI model found');
      return;
    }
    
    console.log(`📍 Using model: ${model.displayName} (${model.provider}:${model.modelId})`);
    
    // 3. Set a rate limit for this model
    console.log('🚫 Setting rate limit for 30 seconds...');
    await rateLimitManager.setRateLimit(model.provider, model.modelId, 30);
    
    // 4. Add a job to the queue
    console.log('📤 Adding course generation job...');
    const job = await courseGenerationQueue.add('test-rate-limit', {
      courseId: testCourse.courseId,
      jobType: 'outline',
      context: {
        courseTitle: testCourse.title,
        courseDescription: testCourse.description,
        courseLevel: testCourse.level,
      },
    });
    
    console.log(`✅ Job added with ID: ${job.id}`);
    console.log('');
    console.log('🔍 Monitoring job behavior...');
    console.log('Expected behavior:');
    console.log('  1. Job should fail with RateLimitError');
    console.log('  2. BullMQ should schedule retry with custom backoff');
    console.log('  3. After 30s, job should succeed');
    
    // 5. Monitor the job for a while
    let attempts = 0;
    const maxAttempts = 15; // Monitor for ~30 seconds
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      try {
        const updatedJob = await courseGenerationQueue.getJob(job.id!);
        if (!updatedJob) {
          console.log('❌ Job not found');
          break;
        }
        
        const state = await updatedJob.getState();
        const attemptsMade = updatedJob.attemptsMade;
        const progress = updatedJob.progress;
        
        console.log(`📊 Job ${job.id} - State: ${state}, Attempts: ${attemptsMade}, Progress: ${progress}`);
        
        if (state === 'completed') {
          console.log('🎉 Job completed successfully!');
          break;
        } else if (state === 'failed') {
          console.log(`❌ Job failed permanently: ${updatedJob.failedReason}`);
          break;
        } else if (state === 'waiting') {
          console.log('⏳ Job is waiting for retry...');
        } else if (state === 'delayed') {
          console.log('⏰ Job is delayed due to backoff strategy');
        } else if (state === 'active') {
          console.log('🏃 Job is currently processing');
        }
        
        // Check rate limit status
        const rateLimitInfo = await rateLimitManager.checkRateLimit(model.provider, model.modelId);
        if (rateLimitInfo.isRateLimited) {
          console.log(`   🚫 Rate limit active: ${rateLimitInfo.secondsRemaining}s remaining`);
        } else {
          console.log('   ✅ Rate limit expired');
        }
        
      } catch (error) {
        console.log(`⚠️ Error checking job status: ${error.message}`);
      }
      
      attempts++;
    }
    
    console.log('');
    console.log('🧹 Cleaning up...');
    
    // Clear the rate limit
    await rateLimitManager.clearRateLimit(model.provider, model.modelId);
    console.log('✅ Rate limit cleared');
    
    // Remove the test job if it still exists
    try {
      const testJob = await courseGenerationQueue.getJob(job.id!);
      if (testJob) {
        await testJob.remove();
        console.log('✅ Test job removed');
      }
    } catch (error) {
      console.log('⚠️ Test job may have already been processed');
    }
    
    console.log('🏁 Rate limiting integration test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testRateLimitingIntegration().catch(console.error);