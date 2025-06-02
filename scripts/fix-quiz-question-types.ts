import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixQuizQuestionTypes() {
  try {
    console.log('🔍 Looking for quiz questions with invalid question types...');
    
    // Find all quiz questions
    const questions = await prisma.courseQuizQuestion.findMany({
      select: {
        questionId: true,
        questionType: true,
        questionText: true,
      },
    });
    
    console.log(`Found ${questions.length} total quiz questions`);
    
    let fixedCount = 0;
    
    for (const question of questions) {
      // Check if the question type needs fixing
      if (question.questionType === 'FILL_IN_THE_BLANK' as any) {
        console.log(`Fixing question ${question.questionId}: "${question.questionText.substring(0, 50)}..."`);
        
        await prisma.courseQuizQuestion.update({
          where: { questionId: question.questionId },
          data: { questionType: 'FILL_IN_BLANK' },
        });
        
        fixedCount++;
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} quiz questions`);
    
    // Also check for any questions with completely invalid types
    const validTypes = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_BLANK', 'ESSAY'];
    const invalidQuestions = questions.filter(q => !validTypes.includes(q.questionType as string));
    
    if (invalidQuestions.length > 0) {
      console.log(`\n⚠️  Found ${invalidQuestions.length} questions with invalid types:`);
      for (const q of invalidQuestions) {
        console.log(`  - Question ${q.questionId}: type "${q.questionType}"`);
        
        // Default invalid types to MULTIPLE_CHOICE
        await prisma.courseQuizQuestion.update({
          where: { questionId: q.questionId },
          data: { questionType: 'MULTIPLE_CHOICE' },
        });
        fixedCount++;
      }
    }
    
    console.log(`\n✅ Total fixed: ${fixedCount} quiz questions`);
    
  } catch (error) {
    console.error('❌ Error fixing quiz question types:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixQuizQuestionTypes();