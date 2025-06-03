#!/usr/bin/env npx tsx

import { prisma } from '../src/lib/prisma';

async function checkCourseProgress(userEmail?: string) {
  try {
    console.log('🔍 Checking course progress data...');

    let whereClause: any = {};
    if (userEmail) {
      whereClause.user = { email: userEmail };
    }

    // Find enrollments with progress
    const enrollments = await prisma.courseEnrollment.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          }
        },
        course: {
          select: {
            title: true,
            courseId: true,
          }
        },
        progress: {
          orderBy: { lastAccessedAt: 'desc' },
          take: 10, // Show latest 10 progress entries
        }
      },
      orderBy: { enrolledAt: 'desc' }
    });

    console.log(`📊 Found ${enrollments.length} course enrollments`);

    for (const enrollment of enrollments) {
      console.log(`\n📚 Course: ${enrollment.course.title}`);
      console.log(`👤 User: ${enrollment.user.email}`);
      console.log(`📅 Enrolled: ${enrollment.enrolledAt.toLocaleDateString()}`);
      console.log(`📈 Progress entries: ${enrollment.progress.length}`);

      if (enrollment.progress.length > 0) {
        const progressWithData = enrollment.progress.filter(p => 
          p.timeSpent > 0 || p.scrollPercentage > 0
        );
        
        console.log(`📊 Entries with tracking data: ${progressWithData.length}`);
        
        if (progressWithData.length > 0) {
          console.log(`\nLatest progress entries with data:`);
          progressWithData.slice(0, 5).forEach((p, index) => {
            console.log(`   ${index + 1}. Article: ${p.articleId.slice(-8)}`);
            console.log(`      ⏱️  Time: ${p.timeSpent}s`);
            console.log(`      📜 Scroll: ${p.scrollPercentage}%`);
            console.log(`      ✅ Completed: ${p.isCompleted ? 'Yes' : 'No'}`);
            console.log(`      🕐 Last accessed: ${p.lastAccessedAt?.toLocaleString() || 'Never'}`);
          });
        } else {
          console.log(`   ⚠️  No tracking data found (all timeSpent=0, scrollPercentage=0)`);
        }
      } else {
        console.log(`   ⚠️  No progress entries found`);
      }
    }

    console.log(`\n✅ Check complete!`);

  } catch (error) {
    console.error('❌ Error checking course progress:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const userEmail = process.argv[2];

if (userEmail && !userEmail.includes('@')) {
  console.log('Usage: npx tsx scripts/check-course-progress.ts [userEmail]');
  console.log('Example: npx tsx scripts/check-course-progress.ts simonjcarr@gmail.com');
  process.exit(1);
}

// Run the script
checkCourseProgress(userEmail);