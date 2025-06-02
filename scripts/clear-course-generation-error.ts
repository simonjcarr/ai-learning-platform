import { PrismaClient, CourseGenerationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function clearCourseGenerationError() {
  try {
    console.log('🔍 Looking for courses with generation errors...\n');
    
    const errorCourses = await prisma.course.findMany({
      where: {
        generationError: {
          not: null,
        },
      },
    });
    
    console.log(`Found ${errorCourses.length} courses with generation errors`);
    
    for (const course of errorCourses) {
      console.log(`\n📚 Course: ${course.title}`);
      console.log(`   Status: ${course.status}`);
      console.log(`   Generation Status: ${course.generationStatus}`);
      console.log(`   Error: ${course.generationError?.substring(0, 100)}...`);
      
      // Clear the error and reset generation status to completed
      // since the course structure was generated successfully
      await prisma.course.update({
        where: { courseId: course.courseId },
        data: {
          generationError: null,
          generationStatus: CourseGenerationStatus.COMPLETED,
        },
      });
      
      console.log(`   ✅ Cleared error and set status to COMPLETED`);
    }
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error clearing course generation errors:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearCourseGenerationError();