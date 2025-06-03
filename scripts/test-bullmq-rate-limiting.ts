import { rateLimitManager, RateLimitError } from '../src/lib/rate-limit';
import { courseGenerationQueue } from '../src/lib/bullmq';
import { prisma } from '../src/lib/prisma';

async function testBullMQRateLimiting() {
  console.log('🧪 Testing BullMQ Rate Limiting Integration');
  
  // First, set up a test rate limit
  const testProvider = 'test-provider';
  const testModelId = 'test-model';
  
  console.log('\n1. Setting up test rate limit...');
  await rateLimitManager.setRateLimit(testProvider, testModelId, 30); // 30 second timeout
  
  const rateLimitInfo = await rateLimitManager.checkRateLimit(testProvider, testModelId);
  console.log(`✅ Rate limit set: ${rateLimitInfo.isRateLimited ? 'Active' : 'Not active'}`);
  console.log(`   Seconds remaining: ${rateLimitInfo.secondsRemaining}`);
  
  // Test creating a job with course data
  console.log('\n2. Creating test course...');
  
  try {
    // Create a test course if it doesn't exist
    const testCourse = await prisma.course.upsert({
      where: { slug: 'test-rate-limit-course' },
      update: {},
      create: {
        title: 'Test Rate Limit Course',
        description: 'A test course for rate limiting',
        slug: 'test-rate-limit-course',
        level: 'BEGINNER',
        status: 'DRAFT',
        generationStatus: 'PENDING',
        systemPromptTitle: 'Test Course',
        systemPromptDescription: 'Test course for rate limiting',
      },
    });
    
    console.log(`✅ Test course created/found: ${testCourse.courseId}`);
    
    // Add a job to the queue
    console.log('\n3. Adding course generation job to queue...');
    const job = await courseGenerationQueue.add('course-outline', {
      courseId: testCourse.courseId,
      jobType: 'outline',
      context: {
        courseTitle: testCourse.title,
        courseDescription: testCourse.description,
        courseLevel: testCourse.level,
      },
    });
    
    console.log(`✅ Job added with ID: ${job.id}`);
    
    // Monitor the job
    console.log('\n4. Monitoring job status...');
    
    job.log('Test job started for rate limiting verification');
    
    // Wait a bit and check job status
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const updatedJob = await courseGenerationQueue.getJob(job.id!);
      if (!updatedJob) {
        console.log('❌ Job not found');
        break;
      }
      
      const state = await updatedJob.getState();
      console.log(`📊 Job ${job.id} - State: ${state}, Attempts: ${updatedJob.attemptsMade}, Progress: ${updatedJob.progress}`);
      
      if (state === 'completed') {
        console.log('✅ Job completed successfully');
        break;
      } else if (state === 'failed') {
        const failedReason = updatedJob.failedReason;
        console.log(`❌ Job failed: ${failedReason}`);
        
        // Check if it's a rate limit error
        if (failedReason?.includes('Rate limit')) {
          console.log('🔄 Rate limit error detected - this is expected for this test');
        }
        break;
      } else if (state === 'waiting') {
        console.log(`⏳ Job is waiting (likely due to backoff strategy)`);
      } else if (state === 'delayed') {
        const delay = await updatedJob.opts.delay;
        console.log(`⏰ Job is delayed (backoff applied), delay: ${delay}ms`);
      }
      
      attempts++;
    }
    
    // Clean up
    console.log('\n5. Cleaning up...');
    await rateLimitManager.clearRateLimit(testProvider, testModelId);
    
    // Remove the test job
    try {
      const testJob = await courseGenerationQueue.getJob(job.id!);
      if (testJob) {
        await testJob.remove();
        console.log('✅ Test job removed');
      }
    } catch (error) {
      console.log('⚠️ Could not remove test job (it may have already been processed)');
    }
    
    console.log('✅ Rate limit cleared');
    console.log('\n🎉 BullMQ rate limiting test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBullMQRateLimiting().catch(console.error);