import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient, CourseGenerationStatus, CourseStatus, CourseLevel } from '@prisma/client';
import { CourseGenerationJobData } from '@/lib/bullmq';
import { callAI } from '@/lib/ai-service';

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

interface CourseOutline {
  title: string;
  description: string;
  sections: Array<{
    title: string;
    description: string;
    articles: Array<{
      title: string;
      description: string;
    }>;
  }>;
}

async function processCourseGenerationJob(job: Job<CourseGenerationJobData>) {
  const { courseId, jobType, sectionId, articleId, context } = job.data;
  
  console.log(`🎓 Processing course generation job: ${jobType} for course ${courseId}`);

  try {
    switch (jobType) {
      case 'outline':
        return await generateCourseOutline(courseId, context);
      case 'article_content':
        return await generateArticleContent(courseId, articleId!, context);
      case 'quiz_generation':
        return await generateQuizzes(courseId, sectionId, articleId, context);
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  } catch (error) {
    console.error(`❌ Course generation job failed: ${error.message}`);
    
    // Update course status to indicate error
    await prisma.course.update({
      where: { courseId },
      data: {
        generationStatus: CourseGenerationStatus.FAILED,
        generationError: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    
    throw error;
  }
}

async function generateCourseOutline(courseId: string, context?: any) {
  console.log(`📝 Generating course outline for course ${courseId}`);
  
  // Update course status
  await prisma.course.update({
    where: { courseId },
    data: {
      generationStatus: CourseGenerationStatus.IN_PROGRESS,
      generationStartedAt: new Date(),
    },
  });

  const course = await prisma.course.findUnique({
    where: { courseId },
  });

  if (!course) {
    throw new Error('Course not found');
  }

  // Use system prompts if available, otherwise fall back to title/description
  const promptTitle = course.systemPromptTitle || course.title;
  const promptDescription = course.systemPromptDescription || course.description;

  const prompt = `Create a comprehensive course for a ${course.level.toLowerCase()} level audience.

Topic/Requirements: ${promptTitle}
Detailed Requirements: ${promptDescription}
Target Audience: ${course.level}

Please generate:
1. An engaging course title that accurately reflects the content
2. A detailed course description (2-3 paragraphs) that explains what students will learn, prerequisites, and outcomes
3. A comprehensive course outline with 4-8 sections. Each section should have 3-6 articles that break down the section content into manageable chunks.

Return the response as a valid JSON object with the following structure:
{
  "title": "Generated Course Title",
  "description": "Detailed course description...",
  "sections": [
    {
      "title": "Section Title",
      "description": "Brief description of what this section covers",
      "articles": [
        {
          "title": "Article Title",
          "description": "Brief description of what this article covers"
        }
      ]
    }
  ]
}

Make sure the content is:
- Appropriate for the ${course.level.toLowerCase()} skill level
- Comprehensive and covers the subject matter thoroughly
- Logically structured from basic to advanced concepts
- Practical with real-world applications
- Engaging and educational

Return ONLY the JSON object, no additional text.`;

  const response = await callAI('course_outline_generation', prompt, {
    courseId,
    courseTitle: course.title,
    courseDescription: course.description,
    courseLevel: course.level,
  });

  let outline: CourseOutline;
  try {
    // Clean up the response by removing any markdown code block wrappers
    let cleanedResponse = response.trim();
    
    // Remove markdown code block wrappers if present
    if (cleanedResponse.startsWith('```json\n') && cleanedResponse.endsWith('\n```')) {
      cleanedResponse = cleanedResponse.slice(8, -4).trim();
    } else if (cleanedResponse.startsWith('```\n') && cleanedResponse.endsWith('\n```')) {
      cleanedResponse = cleanedResponse.slice(4, -4).trim();
    } else if (cleanedResponse.startsWith('```json') && cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.slice(7, -3).trim();
    } else if (cleanedResponse.startsWith('```') && cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.slice(3, -3).trim();
    }
    
    outline = JSON.parse(cleanedResponse);
  } catch (parseError) {
    console.error('Raw AI response:', response);
    throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
  }

  // Store the outline and update the course title and description
  await prisma.course.update({
    where: { courseId },
    data: {
      title: outline.title,
      description: outline.description,
      courseOutlineJson: outline,
      generationStatus: CourseGenerationStatus.COMPLETED,
    },
  });

  // Create sections and articles based on the outline
  for (let sectionIndex = 0; sectionIndex < outline.sections.length; sectionIndex++) {
    const sectionData = outline.sections[sectionIndex];
    
    const section = await prisma.courseSection.create({
      data: {
        courseId,
        title: sectionData.title,
        description: sectionData.description,
        orderIndex: sectionIndex,
      },
    });

    // Create articles for this section
    for (let articleIndex = 0; articleIndex < sectionData.articles.length; articleIndex++) {
      const articleData = sectionData.articles[articleIndex];
      
      const slugBase = articleData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      const articleSlug = `${course.slug}-${slugBase}`;

      await prisma.courseArticle.create({
        data: {
          sectionId: section.sectionId,
          title: articleData.title,
          slug: articleSlug,
          description: articleData.description,
          orderIndex: articleIndex,
        },
      });
    }
  }

  // Update course status to published
  await prisma.course.update({
    where: { courseId },
    data: {
      status: CourseStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  console.log(`✅ Course outline generated successfully for course ${courseId}`);
  return { success: true, outline };
}

async function generateArticleContent(courseId: string, articleId: string, context?: any) {
  console.log(`📄 Generating article content for article ${articleId}`);

  const article = await prisma.courseArticle.findUnique({
    where: { articleId },
    include: {
      section: {
        include: {
          course: true,
        },
      },
    },
  });

  if (!article) {
    throw new Error('Article not found');
  }

  const course = article.section.course;
  const section = article.section;

  const prompt = `Generate comprehensive educational content for this course article.

Course: ${course.title} (${course.level} level)
Course Description: ${course.description}
Section: ${section.title}
Section Description: ${section.description}
Article: ${article.title}
Article Description: ${article.description}

Please write detailed, educational content that:
- Is appropriate for ${course.level.toLowerCase()} level learners
- Covers the topic thoroughly with practical examples
- Uses clear explanations and step-by-step instructions where applicable
- Includes code examples if relevant to the subject matter
- Uses proper Markdown formatting with headings, paragraphs, lists, and code blocks
- Is engaging and educational
- Builds upon previous concepts appropriately

The content should be substantial (at least 1000 words) and include:
1. Introduction to the topic
2. Key concepts and explanations
3. Practical examples and demonstrations
4. Best practices and common pitfalls
5. Summary and next steps

Return the content as properly formatted Markdown suitable for educational purposes. Start directly with the title using # heading and use proper Markdown formatting throughout.`;

  const content = await callAI('course_article_generation', prompt, {
    courseId,
    sectionId: section.sectionId,
    articleId,
    courseTitle: course.title,
    courseLevel: course.level,
    sectionTitle: section.title,
    articleTitle: article.title,
  });

  // Clean up any markdown code block wrappers in content
  let cleanedContent = content.trim();
  if (cleanedContent.startsWith('```markdown\n') && cleanedContent.endsWith('\n```')) {
    cleanedContent = cleanedContent.slice(12, -4).trim();
  } else if (cleanedContent.startsWith('```\n') && cleanedContent.endsWith('\n```')) {
    cleanedContent = cleanedContent.slice(4, -4).trim();
  } else if (cleanedContent.startsWith('```markdown') && cleanedContent.endsWith('```')) {
    cleanedContent = cleanedContent.slice(11, -3).trim();
  } else if (cleanedContent.startsWith('```') && cleanedContent.endsWith('```')) {
    cleanedContent = cleanedContent.slice(3, -3).trim();
  }

  // Update the article with generated content
  await prisma.courseArticle.update({
    where: { articleId },
    data: {
      contentHtml: cleanedContent,
      isGenerated: true,
      generatedAt: new Date(),
    },
  });

  console.log(`✅ Article content generated successfully for article ${articleId}`);
  return { success: true, articleId };
}

async function generateQuizzes(courseId: string, sectionId?: string, articleId?: string, context?: any) {
  console.log(`❓ Generating quizzes for course ${courseId}`);

  if (articleId) {
    // Generate quiz for specific article
    return await generateArticleQuiz(articleId);
  } else if (sectionId) {
    // Generate quiz for entire section
    return await generateSectionQuiz(sectionId);
  } else {
    // Generate final exam for entire course
    return await generateFinalExam(courseId);
  }
}

async function generateArticleQuiz(articleId: string) {
  const article = await prisma.courseArticle.findUnique({
    where: { articleId },
    include: {
      section: {
        include: {
          course: true,
        },
      },
    },
  });

  if (!article || !article.contentHtml) {
    throw new Error('Article not found or has no content');
  }

  const course = article.section.course;

  const prompt = `Generate a quiz with 3-5 questions based on this course article content.

Course: ${course.title} (${course.level} level)
Section: ${article.section.title}
Article: ${article.title}
Content: ${article.contentHtml.substring(0, 2000)}...

Create questions that test understanding of the key concepts covered in this article. Use a mix of question types.

IMPORTANT: Use exactly these question type values:
- "MULTIPLE_CHOICE" for multiple choice questions
- "TRUE_FALSE" for true/false questions  
- "FILL_IN_BLANK" for fill in the blank questions (NOT "FILL_IN_THE_BLANK")

Return the response as a JSON object with this structure:
{
  "questions": [
    {
      "type": "MULTIPLE_CHOICE",
      "question": "Question text here?",
      "options": {
        "a": "Option A",
        "b": "Option B", 
        "c": "Option C",
        "d": "Option D"
      },
      "correctAnswer": "a",
      "explanation": "Explanation of why this is correct"
    },
    {
      "type": "TRUE_FALSE",
      "question": "Statement to evaluate",
      "correctAnswer": "true",
      "explanation": "Explanation"
    },
    {
      "type": "FILL_IN_BLANK",
      "question": "The _____ command is used to list files in Linux",
      "correctAnswer": "ls",
      "explanation": "The ls command lists directory contents"
    }
  ]
}

Return ONLY the JSON object.`;

  const response = await callAI('course_quiz_generation', prompt, {
    articleId,
    courseId: course.courseId,
  });

  // Clean up the response by removing any markdown code block wrappers
  let cleanedResponse = response.trim();
  
  // Remove markdown code block wrappers if present
  if (cleanedResponse.startsWith('```json\n') && cleanedResponse.endsWith('\n```')) {
    cleanedResponse = cleanedResponse.slice(8, -4).trim();
  } else if (cleanedResponse.startsWith('```\n') && cleanedResponse.endsWith('\n```')) {
    cleanedResponse = cleanedResponse.slice(4, -4).trim();
  } else if (cleanedResponse.startsWith('```json') && cleanedResponse.endsWith('```')) {
    cleanedResponse = cleanedResponse.slice(7, -3).trim();
  } else if (cleanedResponse.startsWith('```') && cleanedResponse.endsWith('```')) {
    cleanedResponse = cleanedResponse.slice(3, -3).trim();
  }
  
  const quizData = JSON.parse(cleanedResponse);

  // Create the quiz
  const quiz = await prisma.courseQuiz.create({
    data: {
      articleId,
      title: `${article.title} - Quiz`,
      description: `Test your knowledge of ${article.title}`,
      quizType: 'article',
      passMarkPercentage: 70.0,
    },
  });

  // Create questions
  for (let i = 0; i < quizData.questions.length; i++) {
    const questionData = quizData.questions[i];
    
    // Map AI-generated question types to database enum values
    let questionType = questionData.type;
    if (questionType === 'FILL_IN_THE_BLANK') {
      questionType = 'FILL_IN_BLANK';
    }
    
    // Validate question type
    const validTypes = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_BLANK', 'ESSAY'];
    if (!validTypes.includes(questionType)) {
      console.error(`Invalid question type: ${questionType}, defaulting to MULTIPLE_CHOICE`);
      questionType = 'MULTIPLE_CHOICE';
    }
    
    await prisma.courseQuizQuestion.create({
      data: {
        quizId: quiz.quizId,
        questionType: questionType as any,
        questionText: questionData.question,
        optionsJson: questionData.options || null,
        correctAnswer: questionData.correctAnswer,
        explanation: questionData.explanation,
        orderIndex: i,
        points: 1.0,
      },
    });
  }

  return { success: true, quizId: quiz.quizId };
}

async function generateSectionQuiz(sectionId: string) {
  console.log(`📝 Generating section quiz for section ${sectionId}`);
  
  const section = await prisma.courseSection.findUnique({
    where: { sectionId },
    include: {
      course: true,
      articles: {
        where: {
          contentHtml: { not: null },
        },
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  if (!section || section.articles.length === 0) {
    throw new Error('Section not found or has no articles with content');
  }

  const course = section.course;

  // Aggregate content from all articles in the section
  const sectionContent = section.articles
    .map(article => `Article: ${article.title}\n${article.contentHtml?.substring(0, 1000)}...`)
    .join('\n\n');

  const prompt = `Generate a comprehensive section quiz based on all the content from this course section.

Course: ${course.title} (${course.level} level)
Section: ${section.title}
Section Description: ${section.description || 'N/A'}
Number of Articles: ${section.articles.length}

Section Content Overview:
${sectionContent.substring(0, 4000)}...

Create 8-12 questions that:
- Test understanding across ALL articles in this section
- Cover the key concepts from different articles
- Use a good mix of question types
- Are appropriate for a section-level assessment

IMPORTANT: Use exactly these question type values:
- "MULTIPLE_CHOICE" for multiple choice questions
- "TRUE_FALSE" for true/false questions  
- "FILL_IN_BLANK" for fill in the blank questions (NOT "FILL_IN_THE_BLANK")

Return the response as a JSON object with this structure:
{
  "title": "Section Quiz Title",
  "description": "Brief description of what this quiz covers",
  "questions": [
    {
      "type": "MULTIPLE_CHOICE",
      "question": "Question text here?",
      "options": {
        "a": "Option A",
        "b": "Option B", 
        "c": "Option C",
        "d": "Option D"
      },
      "correctAnswer": "a",
      "explanation": "Explanation of why this is correct"
    },
    {
      "type": "TRUE_FALSE",
      "question": "Statement to evaluate",
      "correctAnswer": "true",
      "explanation": "Explanation"
    },
    {
      "type": "FILL_IN_BLANK",
      "question": "The _____ command is used to list files in Linux",
      "correctAnswer": "ls",
      "explanation": "The ls command lists directory contents"
    }
  ]
}

Return ONLY the JSON object.`;

  const response = await callAI('course_quiz_generation', prompt, {
    sectionId,
    courseId: course.courseId,
    sectionTitle: section.title,
  });

  // Clean up the response by removing any markdown code block wrappers
  let cleanedResponse = response.trim();
  
  // Remove markdown code block wrappers if present
  if (cleanedResponse.startsWith('```json\n') && cleanedResponse.endsWith('\n```')) {
    cleanedResponse = cleanedResponse.slice(8, -4).trim();
  } else if (cleanedResponse.startsWith('```\n') && cleanedResponse.endsWith('\n```')) {
    cleanedResponse = cleanedResponse.slice(4, -4).trim();
  } else if (cleanedResponse.startsWith('```json') && cleanedResponse.endsWith('```')) {
    cleanedResponse = cleanedResponse.slice(7, -3).trim();
  } else if (cleanedResponse.startsWith('```') && cleanedResponse.endsWith('```')) {
    cleanedResponse = cleanedResponse.slice(3, -3).trim();
  }
  
  const quizData = JSON.parse(cleanedResponse);

  // Create the quiz
  const quiz = await prisma.courseQuiz.create({
    data: {
      sectionId,
      title: quizData.title || `${section.title} - Section Quiz`,
      description: quizData.description || `Test your knowledge of the ${section.title} section`,
      quizType: 'section',
      passMarkPercentage: 75.0, // Higher pass mark for section quizzes
    },
  });

  // Create questions
  for (let i = 0; i < quizData.questions.length; i++) {
    const questionData = quizData.questions[i];
    
    // Map AI-generated question types to database enum values
    let questionType = questionData.type;
    if (questionType === 'FILL_IN_THE_BLANK') {
      questionType = 'FILL_IN_BLANK';
    }
    
    // Validate question type
    const validTypes = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_BLANK', 'ESSAY'];
    if (!validTypes.includes(questionType)) {
      console.error(`Invalid question type: ${questionType}, defaulting to MULTIPLE_CHOICE`);
      questionType = 'MULTIPLE_CHOICE';
    }
    
    await prisma.courseQuizQuestion.create({
      data: {
        quizId: quiz.quizId,
        questionType: questionType as any,
        questionText: questionData.question,
        optionsJson: questionData.options || null,
        correctAnswer: questionData.correctAnswer,
        explanation: questionData.explanation,
        orderIndex: i,
        points: 1.0,
      },
    });
  }

  console.log(`✅ Section quiz generated successfully for section ${sectionId}`);
  return { success: true, quizId: quiz.quizId };
}

async function generateFinalExam(courseId: string) {
  // Similar implementation for final exam
  console.log(`🎓 Generating final exam for course ${courseId}`);
  return { success: true, message: 'Final exam generation not yet implemented' };
}

// Create the worker
export const courseGenerationWorker = new Worker('course-generation', processCourseGenerationJob, {
  connection: connection.duplicate(),
  concurrency: 2, // Limit concurrency to avoid overwhelming AI APIs
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
});

courseGenerationWorker.on('completed', (job) => {
  console.log(`🎓 Course generation job ${job.id} completed`);
});

courseGenerationWorker.on('failed', (job, err) => {
  console.error(`❌ Course generation job ${job?.id} failed:`, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down course generation worker...');
  await courseGenerationWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});