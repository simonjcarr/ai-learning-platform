#!/usr/bin/env npx tsx

import { prisma } from '../src/lib/prisma';
import { generateCertificate } from '../src/lib/certificate-generator';

async function generateMissingCertificates() {
  try {
    console.log('🔍 Checking for passed final exams without certificates...');

    // Find all passed final exam attempts
    const passedExams = await prisma.finalExamAttempt.findMany({
      where: { 
        passed: true 
      },
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

    // Check which ones already have certificates
    const existingCertificates = await prisma.courseCertificate.findMany({
      select: {
        courseId: true,
        clerkUserId: true,
      }
    });

    const existingCertSet = new Set(
      existingCertificates.map(cert => `${cert.courseId}-${cert.clerkUserId}`)
    );

    const missingCertificates = passedExams.filter(exam => 
      !existingCertSet.has(`${exam.courseId}-${exam.clerkUserId}`)
    );

    console.log(`🎯 Found ${missingCertificates.length} exams that need certificates generated`);

    if (missingCertificates.length === 0) {
      console.log('✅ All passed exams already have certificates!');
      return;
    }

    // Group by user and course to get the best score for each
    const bestScores = new Map<string, { exam: any, bestScore: number }>();
    
    for (const exam of missingCertificates) {
      const key = `${exam.courseId}-${exam.clerkUserId}`;
      const current = bestScores.get(key);
      
      if (!current || exam.score! > current.bestScore) {
        bestScores.set(key, { exam, bestScore: exam.score! });
      }
    }

    console.log(`🏆 Generating certificates for ${bestScores.size} unique course completions...`);

    let successCount = 0;
    let errorCount = 0;

    for (const { exam, bestScore } of bestScores.values()) {
      try {
        console.log(`\n📜 Generating certificate for ${exam.user.email} - ${exam.course.title}`);
        console.log(`   Score: ${bestScore}% | Course: ${exam.course.courseId}`);

        await generateCertificate({
          courseId: exam.courseId,
          clerkUserId: exam.clerkUserId,
          finalExamScore: bestScore
        });

        successCount++;
        console.log(`   ✅ Certificate generated successfully!`);
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Failed to generate certificate:`, error);
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Successfully generated: ${successCount} certificates`);
    console.log(`   ❌ Failed to generate: ${errorCount} certificates`);
    console.log(`   📊 Total processed: ${bestScores.size} completions`);

    if (successCount > 0) {
      console.log(`\n🎉 Certificates are now available at /dashboard/certificates`);
    }

  } catch (error) {
    console.error('❌ Error in generateMissingCertificates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
generateMissingCertificates();