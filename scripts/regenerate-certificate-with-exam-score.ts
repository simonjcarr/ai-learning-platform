#!/usr/bin/env npx tsx

import { prisma } from '../src/lib/prisma';
import { generateCertificate } from '../src/lib/certificate-generator';

async function regenerateCertificateWithExamScore(userEmail?: string) {
  try {
    console.log('🔄 Regenerating certificates with final exam scores...');

    let whereClause: any = {};
    if (userEmail) {
      whereClause.user = { email: userEmail };
    }

    // Find certificates that need to be regenerated
    const certificates = await prisma.courseCertificate.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            email: true,
            clerkUserId: true,
          }
        },
        course: {
          select: {
            title: true,
            courseId: true,
          }
        }
      }
    });

    console.log(`📊 Found ${certificates.length} certificates to regenerate`);

    if (certificates.length === 0) {
      console.log('ℹ️  No certificates found to regenerate');
      return;
    }

    let regeneratedCount = 0;
    let skippedCount = 0;

    for (const certificate of certificates) {
      try {
        // Get the final exam score from the course
        const finalExam = await prisma.courseQuizAttempt.findFirst({
          where: {
            clerkUserId: certificate.clerkUserId,
            quiz: {
              courseId: certificate.courseId,
              quizType: 'final_exam',
            },
            passed: true,
          },
          orderBy: { score: 'desc' },
        });

        if (!finalExam) {
          console.log(`⚠️  No passing final exam found for ${certificate.user.email} - ${certificate.course.title}`);
          skippedCount++;
          continue;
        }

        // Regenerate certificate with final exam score
        const newCertificate = await generateCertificate({
          courseId: certificate.courseId,
          clerkUserId: certificate.clerkUserId,
          finalExamScore: finalExam.score!,
        });

        console.log(`✅ Regenerated certificate for ${certificate.user.email} - ${certificate.course.title}`);
        console.log(`   Final Exam Score: ${finalExam.score}%`);
        regeneratedCount++;

      } catch (error) {
        console.error(`❌ Failed to regenerate certificate for ${certificate.user.email}:`, error);
        skippedCount++;
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Regenerated: ${regeneratedCount} certificates`);
    console.log(`   ⏭️  Skipped: ${skippedCount} certificates`);
    console.log(`   📊 Total processed: ${certificates.length} certificates`);

    if (regeneratedCount > 0) {
      console.log(`\n🎉 Certificates have been regenerated with final exam scores!`);
    }

  } catch (error) {
    console.error('❌ Error in regenerateCertificateWithExamScore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const userEmail = process.argv[2];

if (userEmail && !userEmail.includes('@')) {
  console.log('Usage: npx tsx scripts/regenerate-certificate-with-exam-score.ts [userEmail]');
  console.log('Example: npx tsx scripts/regenerate-certificate-with-exam-score.ts simonjcarr@gmail.com');
  process.exit(1);
}

// Run the script
regenerateCertificateWithExamScore(userEmail);