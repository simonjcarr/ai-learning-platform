import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkQuizData() {
  try {
    console.log('🔍 Checking quiz data...\n');
    
    // Check courses
    const courses = await prisma.course.findMany({
      include: {
        _count: {
          select: {
            sections: true,
          },
        },
      },
    });
    
    console.log(`📚 Courses: ${courses.length}`);
    for (const course of courses) {
      console.log(`  - ${course.title} (${course.status})`);
      console.log(`    Sections: ${course._count.sections}`);
      console.log(`    Generation Status: ${course.generationStatus}`);
      if (course.generationError) {
        console.log(`    ❌ Generation Error: ${course.generationError.substring(0, 100)}...`);
      }
    }
    
    // Check quizzes
    const quizzes = await prisma.courseQuiz.findMany({
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
        article: {
          select: {
            title: true,
          },
        },
      },
    });
    
    console.log(`\n❓ Quizzes: ${quizzes.length}`);
    for (const quiz of quizzes) {
      console.log(`  - ${quiz.title}`);
      console.log(`    Type: ${quiz.quizType}`);
      console.log(`    Questions: ${quiz._count.questions}`);
      if (quiz.article) {
        console.log(`    Article: ${quiz.article.title}`);
      }
    }
    
    // Check quiz questions
    const questions = await prisma.courseQuizQuestion.findMany({
      include: {
        quiz: {
          select: {
            title: true,
          },
        },
      },
    });
    
    console.log(`\n📝 Quiz Questions: ${questions.length}`);
    for (const question of questions) {
      console.log(`  - Quiz: ${question.quiz.title}`);
      console.log(`    Type: ${question.questionType}`);
      console.log(`    Question: ${question.questionText.substring(0, 60)}...`);
    }
    
    // Check for any courses with generation errors
    const errorCourses = await prisma.course.findMany({
      where: {
        generationError: {
          not: null,
        },
      },
    });
    
    if (errorCourses.length > 0) {
      console.log(`\n⚠️  Courses with generation errors: ${errorCourses.length}`);
      for (const course of errorCourses) {
        console.log(`  - ${course.title}`);
        console.log(`    Error: ${course.generationError}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking quiz data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkQuizData();