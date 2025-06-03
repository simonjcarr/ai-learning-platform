#!/usr/bin/env npx tsx

import { prisma } from '../src/lib/prisma';

// Calculate engagement score based on time spent and scroll percentage
const calculateEngagementScore = (timeSpent: number, scrollPercentage: number, contentLength: number = 1000) => {
  // Expected time: 2 minutes per 1000 characters, minimum 3 minutes
  const expectedTime = Math.max(180, Math.ceil(contentLength / 1000) * 120); // 2 minutes per 1000 chars, min 3 min
  
  // Time component (50% of engagement score)
  const timeScore = timeSpent >= expectedTime ? 0.5 : (timeSpent / expectedTime) * 0.5;
  
  // Scroll component (50% of engagement score)
  const scrollScore = scrollPercentage >= 80 ? 0.5 : (scrollPercentage / 80) * 0.5;
  
  // Return score as percentage (0-100)
  return (timeScore + scrollScore) * 100;
};

async function backfillEngagementScores(userEmail?: string) {
  try {
    console.log('🔄 Backfilling engagement scores for course progress...');

    let whereClause: any = {};
    if (userEmail) {
      whereClause.user = { email: userEmail };
    }

    // Find all course progress entries that need engagement scores calculated
    const progressEntries = await prisma.courseProgress.findMany({
      where: {
        OR: [
          { engagementScore: null },
          { engagementScore: 0 }
        ],
        timeSpent: { gt: 0 },
        ...whereClause
      },
      include: {
        article: {
          select: {
            contentHtml: true,
            title: true,
          }
        },
        enrollment: {
          include: {
            user: {
              select: {
                email: true,
              }
            },
            course: {
              select: {
                title: true,
              }
            }
          }
        }
      }
    });

    console.log(`📊 Found ${progressEntries.length} progress entries to update`);

    if (progressEntries.length === 0) {
      console.log('ℹ️  No progress entries need engagement score updates');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const progress of progressEntries) {
      try {
        const contentLength = progress.article?.contentHtml?.length || 1000;
        const newEngagementScore = calculateEngagementScore(
          progress.timeSpent, 
          progress.scrollPercentage, 
          contentLength
        );

        // Only update if there's a meaningful change
        if (newEngagementScore > 0) {
          await prisma.courseProgress.update({
            where: {
              progressId: progress.progressId,
            },
            data: {
              engagementScore: newEngagementScore,
            },
          });

          console.log(`✅ Updated ${progress.enrollment.user.email} - ${progress.article?.title?.slice(0, 50)}...`);
          console.log(`   Time: ${progress.timeSpent}s, Scroll: ${progress.scrollPercentage}%, Engagement: ${newEngagementScore.toFixed(1)}%`);
          updatedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to update progress ${progress.progressId}:`, error);
        skippedCount++;
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Updated: ${updatedCount} progress entries`);
    console.log(`   ⏭️  Skipped: ${skippedCount} entries (no improvement)`);
    console.log(`   📊 Total processed: ${progressEntries.length} entries`);

    if (updatedCount > 0) {
      console.log(`\n🎉 Engagement scores have been backfilled! You can now regenerate certificates.`);
    }

  } catch (error) {
    console.error('❌ Error in backfillEngagementScores:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const userEmail = process.argv[2];

if (userEmail && !userEmail.includes('@')) {
  console.log('Usage: npx tsx scripts/backfill-engagement-scores.ts [userEmail]');
  console.log('Example: npx tsx scripts/backfill-engagement-scores.ts simonjcarr@gmail.com');
  process.exit(1);
}

// Run the script
backfillEngagementScores(userEmail);