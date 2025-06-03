#!/usr/bin/env npx tsx

import { prisma } from '../src/lib/prisma';
import { generateCertificate } from '../src/lib/certificate-generator';

async function regenerateCertificate(courseId?: string, userEmail?: string) {
  try {
    console.log('🔄 Regenerating certificates with updated engagement data...');

    let whereClause: any = { passed: true };
    
    if (courseId) {
      whereClause.courseId = courseId;
    }
    
    if (userEmail) {
      whereClause.user = {
        email: userEmail
      };
    }

    // Find passed final exams
    const passedExams = await prisma.finalExamAttempt.findMany({
      where: whereClause,
      include: {
        course: true,
        user: {
          select: {
            clerkUserId: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: { attemptedAt: 'desc' }
    });

    console.log(`📊 Found ${passedExams.length} passed final exam attempts`);

    if (passedExams.length === 0) {
      console.log('ℹ️  No passed final exams found');
      return;
    }

    // Check course progress data
    for (const exam of passedExams) {
      console.log(`\n🔍 Checking course progress for ${exam.user.email} - ${exam.course.title}`);
      
      const enrollment = await prisma.courseEnrollment.findFirst({
        where: {
          courseId: exam.courseId,
          clerkUserId: exam.clerkUserId,
        },
        include: {
          progress: true,
        }
      });

      if (enrollment) {
        const progressWithData = enrollment.progress.filter(p => 
          p.timeSpent > 0 || p.scrollPercentage > 0
        );
        
        console.log(`   📈 Progress entries: ${enrollment.progress.length}`);
        console.log(`   📊 Entries with tracking data: ${progressWithData.length}`);
        
        if (progressWithData.length > 0) {
          const avgTime = Math.round(
            progressWithData.reduce((sum, p) => sum + p.timeSpent, 0) / progressWithData.length
          );
          const avgScroll = Math.round(
            progressWithData.reduce((sum, p) => sum + p.scrollPercentage, 0) / progressWithData.length
          );
          
          console.log(`   ⏱️  Average time per article: ${avgTime}s`);
          console.log(`   📜 Average scroll percentage: ${avgScroll}%`);
          
          // Regenerate certificate
          console.log(`   🎓 Regenerating certificate...`);
          await generateCertificate({
            courseId: exam.courseId,
            clerkUserId: exam.clerkUserId,
            finalExamScore: exam.score!
          });
          
          console.log(`   ✅ Certificate regenerated successfully!`);
        } else {
          console.log(`   ⚠️  No engagement data found - visit course articles to generate tracking data`);
        }
      } else {
        console.log(`   ❌ No enrollment found`);
      }
    }

    console.log(`\n🎉 Certificate regeneration complete!`);

  } catch (error) {
    console.error('❌ Error in regenerateCertificate:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const courseId = process.argv[2];
const userEmail = process.argv[3];

if (courseId && !courseId.startsWith('cm')) {
  console.log('Usage: npx tsx scripts/regenerate-certificate.ts [courseId] [userEmail]');
  console.log('Example: npx tsx scripts/regenerate-certificate.ts cmbf8v6v4005wslgbo0vndvs7');
  console.log('Example: npx tsx scripts/regenerate-certificate.ts "" simonjcarr@gmail.com');
  process.exit(1);
}

// Run the script
regenerateCertificate(courseId, userEmail);