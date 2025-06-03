import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateQuizPassMarks() {
  try {
    // Get the course completion settings
    const completionSettings = await prisma.courseCompletionSettings.findFirst({
      where: { settingsId: 'default' },
    });

    if (!completionSettings) {
      console.error('❌ No course completion settings found');
      process.exit(1);
    }

    const newPassMark = completionSettings.minQuizAverage;
    console.log(`📊 Updating all quiz pass marks to ${newPassMark}%`);

    // Update all quizzes
    const result = await prisma.courseQuiz.updateMany({
      data: {
        passMarkPercentage: newPassMark,
      },
    });

    console.log(`✅ Updated ${result.count} quizzes with new pass mark of ${newPassMark}%`);
  } catch (error) {
    console.error('❌ Error updating quiz pass marks:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateQuizPassMarks();