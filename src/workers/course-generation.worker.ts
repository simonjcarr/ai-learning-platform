import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient, CourseGenerationStatus, CourseStatus, CourseLevel } from '@prisma/client';
import { CourseGenerationJobData, customBackoffStrategy } from '@/lib/bullmq';
import { callAI, aiService } from '@/lib/ai-service';
import { RateLimitError } from '@/lib/rate-limit';
import YouTubeSearchService, { YouTubeVideoResult } from '@/lib/youtube-search';

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
  
  console.log(`🎓 Processing course generation job: ${jobType} for course ${courseId} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`);

  try {
    switch (jobType) {
      case 'outline':
        return await generateCourseOutline(courseId, context);
      case 'article_content':
        return await generateArticleContent(courseId, articleId!, context);
      case 'quiz_generation':
        return await generateQuizzes(courseId, sectionId, articleId, context);
      case 'final_exam_bank':
        return await generateFinalExamQuestionBank(courseId, context);
      case 'video_enhancement':
        return await enhanceArticleWithVideos(courseId, articleId!, context);
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  } catch (error) {
    console.error(`❌ Course generation job failed: ${error.message}`);
    
    // Handle rate limit errors specially
    if (error instanceof RateLimitError) {
      console.log(`🚫 Rate limit hit for course ${courseId}. Provider: ${error.provider}, Model: ${error.modelId}, Retry after: ${error.retryAfter}s`);
      console.log(`🔄 Job will be retried automatically with backoff strategy`);
      
      // Don't update course status to FAILED - let BullMQ handle the retry
      throw error;
    }
    
    // For non-rate-limit errors, update course status to FAILED
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
  // Only remove outer markdown code block wrappers if the entire content is wrapped
  // This preserves inner code blocks (like mermaid diagrams)
  let cleanedContent = content.trim();
  if (cleanedContent.startsWith('```markdown\n') && cleanedContent.endsWith('\n```')) {
    // Check if there are any other code blocks inside
    const innerContent = cleanedContent.slice(12, -4);
    if (!innerContent.includes('```')) {
      // Safe to remove outer wrapper
      cleanedContent = innerContent.trim();
    }
  } else if (cleanedContent.startsWith('```markdown') && cleanedContent.endsWith('```')) {
    // Check if there are any other code blocks inside
    const innerContent = cleanedContent.slice(11, -3);
    if (!innerContent.includes('```')) {
      // Safe to remove outer wrapper
      cleanedContent = innerContent.trim();
    }
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
  
  // Queue video enhancement job after content generation
  try {
    const { addCourseGenerationToQueue } = await import('@/lib/bullmq');
    await addCourseGenerationToQueue({
      courseId,
      jobType: 'video_enhancement',
      articleId,
      context: {
        courseTitle: course.title,
        courseDescription: course.description,
        courseLevel: course.level,
        sectionTitle: section.title,
        sectionDescription: section.description,
        articleTitle: article.title,
        articleDescription: article.description,
      },
    });
    console.log(`🎬 Queued video enhancement job for article ${articleId}`);
  } catch (error) {
    console.error(`⚠️ Failed to queue video enhancement: ${error.message}`);
    // Don't fail the main job if video enhancement queueing fails
  }
  
  return { success: true, articleId };
}

async function enhanceArticleWithVideos(courseId: string, articleId: string, context?: any) {
  console.log(`📺 Enhancing article ${articleId} with YouTube videos`);

  // Get the article with its content and course context
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

  if (!article.contentHtml || !article.isGenerated) {
    console.log(`⚠️ Article ${articleId} does not have generated content yet, skipping video enhancement`);
    return { success: true, skipped: true, reason: 'No content generated yet' };
  }

  const course = article.section.course;
  const section = article.section;

  try {
    // Step 1: Use AI to analyze content and suggest video search queries
    console.log(`🤖 Analyzing article content for video recommendations...`);
    
    const videoRecommendations = await aiService.generateVideoRecommendations(
      article.title,
      article.contentHtml,
      {
        courseTitle: course.title,
        courseDescription: course.description,
        courseLevel: course.level,
        sectionTitle: section.title,
        sectionDescription: section.description || undefined,
      }
    );

    if (!videoRecommendations.shouldIncludeVideos || videoRecommendations.recommendations.length === 0) {
      console.log(`📝 AI determined no videos would enhance this article: ${videoRecommendations.explanation}`);
      return { 
        success: true, 
        videoRecommendations: null, 
        explanation: videoRecommendations.explanation 
      };
    }

    console.log(`🔍 Found ${videoRecommendations.recommendations.length} video recommendations`);

    // Step 2: Search for YouTube videos using the AI recommendations
    const youtubeService = await YouTubeSearchService.create();
    if (!youtubeService) {
      console.log(`⚠️ YouTube search service not available (no active API model)`);
      return { 
        success: true, 
        skipped: true, 
        reason: 'YouTube API not configured' 
      };
    }

    const videoResults: Array<{
      recommendation: any;
      videos: YouTubeVideoResult[];
    }> = [];

    for (const recommendation of videoRecommendations.recommendations) {
      try {
        console.log(`🔍 Searching YouTube for: "${recommendation.searchQuery}"`);
        
        const videos = await youtubeService.searchEducationalVideos(
          recommendation.searchQuery,
          recommendation.context
        );

        if (videos.length > 0) {
          videoResults.push({
            recommendation,
            videos: videos.slice(0, 1), // Take the best match
          });
          console.log(`✅ Found ${videos.length} videos for "${recommendation.searchQuery}"`);
        } else {
          console.log(`❌ No videos found for "${recommendation.searchQuery}"`);
        }
      } catch (error) {
        console.error(`❌ Error searching for videos: ${error.message}`);
        // Continue with other recommendations even if one fails
      }
    }

    if (videoResults.length === 0) {
      console.log(`📝 No suitable videos found for any recommendations`);
      return { 
        success: true, 
        videoRecommendations, 
        videoResults: [], 
        explanation: 'No suitable videos found' 
      };
    }

    // Step 3: Enhance the article content with video embeds
    let enhancedContent = article.contentHtml;
    const insertedVideos: Array<{
      videoId: string;
      title: string;
      placement: string;
      context: string;
    }> = [];

    for (const result of videoResults) {
      const { recommendation, videos } = result;
      const video = videos[0]; // Use the best match

      if (!video) continue;

      // Create video embed markdown
      const videoMarkdown = youtubeService.formatVideoForMarkdown(video, recommendation.context);
      
      // Insert video based on placement recommendation
      const placement = recommendation.placement;
      
      switch (placement) {
        case 'introduction':
          // Insert after the first heading
          const introMatch = enhancedContent.match(/^(#[^\n]*\n)/);
          if (introMatch) {
            enhancedContent = enhancedContent.replace(
              introMatch[1],
              `${introMatch[1]}\n${videoMarkdown}\n\n`
            );
          }
          break;
          
        case 'middle':
          // Insert in the middle of the content
          const sections = enhancedContent.split(/(?=##[^#])/);
          if (sections.length > 2) {
            const midIndex = Math.floor(sections.length / 2);
            sections.splice(midIndex, 0, `\n${videoMarkdown}\n`);
            enhancedContent = sections.join('');
          }
          break;
          
        case 'conclusion':
          // Insert before the last heading or at the end
          const conclusionMatch = enhancedContent.match(/^(.*)(##[^#][^\n]*\n?.*)$/s);
          if (conclusionMatch) {
            enhancedContent = `${conclusionMatch[1]}\n${videoMarkdown}\n\n${conclusionMatch[2]}`;
          } else {
            enhancedContent += `\n\n${videoMarkdown}`;
          }
          break;
          
        case 'supplement':
        default:
          // Add at the end as supplementary material
          enhancedContent += `\n\n## Additional Resources\n\n${videoMarkdown}`;
          break;
      }

      insertedVideos.push({
        videoId: video.videoId,
        title: video.title,
        placement: placement,
        context: recommendation.context,
      });

      console.log(`📺 Added video "${video.title}" to ${placement} section`);
    }

    // Step 4: Update the article with enhanced content
    await prisma.courseArticle.update({
      where: { articleId },
      data: {
        contentHtml: enhancedContent,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Article ${articleId} enhanced with ${insertedVideos.length} YouTube videos`);
    
    return { 
      success: true, 
      videoRecommendations, 
      videoResults, 
      insertedVideos,
      enhancedContentLength: enhancedContent.length 
    };

  } catch (error) {
    console.error(`❌ Error enhancing article with videos: ${error.message}`);
    
    // Don't fail the job completely for video enhancement failures
    return { 
      success: true, 
      skipped: true, 
      error: error.message 
    };
  }
}

async function generateQuizzes(courseId: string, sectionId?: string, articleId?: string, context?: any) {
  console.log(`❓ Generating quizzes for course ${courseId}`);

  if (articleId) {
    // Generate quiz for specific article
    return await generateArticleQuiz(articleId, context);
  } else if (sectionId) {
    // Generate quiz for entire section
    return await generateSectionQuiz(sectionId, context);
  } else {
    // Generate final exam for entire course
    return await generateFinalExam(courseId, context);
  }
}

async function generateArticleQuiz(articleId: string, context?: any) {
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

  // Check for existing quiz and delete it only if regenerating
  const existingQuiz = await prisma.courseQuiz.findFirst({
    where: {
      articleId,
      quizType: 'article',
    },
  });

  // Only delete existing quiz if this is a regeneration operation
  const regenerateOnly = context?.regenerateOnly || false;
  if (existingQuiz && regenerateOnly) {
    console.log(`📝 Deleting existing article quiz ${existingQuiz.quizId} before regenerating`);
    await prisma.courseQuiz.delete({
      where: { quizId: existingQuiz.quizId },
    });
  } else if (existingQuiz && !regenerateOnly) {
    console.log(`📝 Article quiz already exists for ${articleId}, skipping generation`);
    return { success: true, skipped: true, quizId: existingQuiz.quizId };
  }

  // Get quiz generation settings
  const settings = await prisma.quizGenerationSettings.findFirst({
    where: { settingsId: 'default' },
  });
  
  // Get course completion settings for pass mark
  const completionSettings = await prisma.courseCompletionSettings.findFirst({
    where: { settingsId: 'default' },
  });

  const minQuestions = settings?.articleQuizMinQuestions || 3;
  const maxQuestions = settings?.articleQuizMaxQuestions || 5;
  const questionCount = Math.floor(Math.random() * (maxQuestions - minQuestions + 1)) + minQuestions;

  const prompt = `Generate a quiz with ${questionCount} questions based on this course article content.

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
      passMarkPercentage: completionSettings?.minQuizAverage || 65.0,
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

async function generateSectionQuiz(sectionId: string, context?: any) {
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

  // Check for existing quiz and delete it only if regenerating
  const existingQuiz = await prisma.courseQuiz.findFirst({
    where: {
      sectionId,
      quizType: 'section',
    },
  });

  // Only delete existing quiz if this is a regeneration operation
  const regenerateOnly = context?.regenerateOnly || false;
  if (existingQuiz && regenerateOnly) {
    console.log(`📝 Deleting existing section quiz ${existingQuiz.quizId} before regenerating`);
    await prisma.courseQuiz.delete({
      where: { quizId: existingQuiz.quizId },
    });
  } else if (existingQuiz && !regenerateOnly) {
    console.log(`📝 Section quiz already exists for ${sectionId}, skipping generation`);
    return { success: true, skipped: true, quizId: existingQuiz.quizId };
  }

  // Get quiz generation settings
  const settings = await prisma.quizGenerationSettings.findFirst({
    where: { settingsId: 'default' },
  });
  
  // Get course completion settings for pass mark
  const completionSettings = await prisma.courseCompletionSettings.findFirst({
    where: { settingsId: 'default' },
  });

  const minQuestions = settings?.sectionQuizMinQuestions || 5;
  const maxQuestions = settings?.sectionQuizMaxQuestions || 8;
  const questionCount = Math.floor(Math.random() * (maxQuestions - minQuestions + 1)) + minQuestions;

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

Create ${questionCount} questions that:
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
      passMarkPercentage: completionSettings?.minQuizAverage || 65.0,
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

async function generateFinalExamQuestionBank(courseId: string, context?: any) {
  console.log(`🏦 Generating question bank for final exam - course ${courseId}`);
  
  const course = await prisma.course.findUnique({
    where: { courseId },
    include: {
      sections: {
        include: {
          articles: {
            where: {
              contentHtml: { not: null },
            },
            orderBy: { orderIndex: 'asc' },
          },
        },
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  if (!course || course.sections.length === 0) {
    throw new Error('Course not found or has no sections with content');
  }

  // Check for existing question bank
  const existingQuestions = await prisma.finalExamQuestionBank.findMany({
    where: { courseId },
  });

  // Only delete existing questions if this is a regeneration operation
  const regenerateOnly = context?.regenerateOnly || false;
  if (existingQuestions.length > 0 && regenerateOnly) {
    console.log(`📝 Deleting existing question bank (${existingQuestions.length} questions) before regenerating`);
    await prisma.finalExamQuestionBank.deleteMany({
      where: { courseId },
    });
  } else if (existingQuestions.length > 0 && !regenerateOnly) {
    console.log(`📝 Question bank already exists for ${courseId} (${existingQuestions.length} questions), skipping generation`);
    return { success: true, skipped: true, questionCount: existingQuestions.length };
  }

  // Generate 125 questions total: 10 essay + 115 other types
  // Temporarily reducing for testing - can be changed back to 125 total later
  const totalQuestions = 30; // TODO: Change back to 125 after testing
  const essayQuestions = 3;  // TODO: Change back to 10 after testing
  const otherQuestions = totalQuestions - essayQuestions;

  // Aggregate content from all sections and articles
  const courseContent = course.sections
    .map(section => {
      const articlesContent = section.articles
        .map(article => `Article: ${article.title}\n${article.contentHtml?.substring(0, 1000)}`)
        .join('\n');
      return `Section: ${section.title}\n${section.description || ''}\n${articlesContent}`;
    })
    .join('\n\n');

  // Generate non-essay questions (115 questions)
  const otherQuestionsPrompt = `Generate ${otherQuestions} comprehensive questions for a final exam question bank covering this entire course.

Course: ${course.title} (${course.level} level)
Course Description: ${course.description}
Number of Sections: ${course.sections.length}
Total Articles: ${course.sections.reduce((total, section) => total + section.articles.length, 0)}

Course Content Overview:
${courseContent.substring(0, 10000)}

Create ${otherQuestions} questions that:
- Test comprehensive understanding of the ENTIRE course
- Cover key concepts from ALL sections
- Use a mix of MULTIPLE_CHOICE, TRUE_FALSE, and FILL_IN_BLANK question types
- Are challenging enough for a final exam
- Test both theoretical understanding and practical application
- Are appropriate for ${course.level.toLowerCase()} level learners
- Avoid essay questions (those will be generated separately)

IMPORTANT: Use exactly these question type values:
- "MULTIPLE_CHOICE" for multiple choice questions (about 70% of questions)
- "TRUE_FALSE" for true/false questions (about 20% of questions)
- "FILL_IN_BLANK" for fill in the blank questions (about 10% of questions)

Return the response as a JSON object with this EXACT structure:
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

CRITICAL REQUIREMENTS:
- Return ONLY valid JSON - no markdown, no code blocks, no extra text
- Ensure all strings are properly escaped (use double quotes for JSON strings)
- Make sure there are no trailing commas
- Ensure the JSON array is properly closed with ]
- Do NOT include any explanatory text before or after the JSON`;

  // Generate essay questions (10 questions)
  const essayQuestionsPrompt = `Generate ${essayQuestions} comprehensive essay questions for a final exam question bank covering this entire course.

Course: ${course.title} (${course.level} level)
Course Description: ${course.description}

Course Content Overview:
${courseContent.substring(0, 8000)}

Create ${essayQuestions} essay questions that:
- Test deep understanding and critical thinking about the course material
- Cover major concepts and themes from across the entire course
- Require students to synthesize information from multiple sections
- Are appropriate for ${course.level.toLowerCase()} level learners
- Allow for thoughtful, comprehensive responses (not simple definitions)
- Test practical application and problem-solving skills

IMPORTANT: Use exactly this question type value:
- "ESSAY" for all questions

Return the response as a JSON object with this EXACT structure:
{
  "questions": [
    {
      "type": "ESSAY",
      "question": "Comprehensive essay question that requires analysis and synthesis of course concepts...",
      "correctAnswer": "Sample ideal answer or key points that should be covered in a good response...",
      "explanation": "Grading criteria and what to look for in student responses..."
    }
  ]
}

CRITICAL REQUIREMENTS:
- Return ONLY valid JSON - no markdown, no code blocks, no extra text
- Ensure all strings are properly escaped (use double quotes for JSON strings)
- Make sure there are no trailing commas
- Ensure the JSON array is properly closed with ]
- Do NOT include any explanatory text before or after the JSON`;

  // Generate non-essay questions
  console.log(`📝 Generating ${otherQuestions} non-essay questions...`);
  const otherResponse = await callAI('course_quiz_generation', otherQuestionsPrompt, {
    courseId,
    courseTitle: course.title,
    courseLevel: course.level,
    examType: 'final_exam_bank_other',
  });

  // Generate essay questions
  console.log(`📝 Generating ${essayQuestions} essay questions...`);
  const essayResponse = await callAI('course_quiz_generation', essayQuestionsPrompt, {
    courseId,
    courseTitle: course.title,
    courseLevel: course.level,
    examType: 'final_exam_bank_essay',
  });

  // Parse responses with better error handling
  let otherData, essayData;
  
  try {
    const cleanedOtherResponse = cleanAIResponse(otherResponse);
    console.log(`📝 Cleaned other questions response (${cleanedOtherResponse.length} chars)`);
    otherData = JSON.parse(cleanedOtherResponse);
  } catch (error) {
    console.error(`❌ Failed to parse non-essay questions JSON:`, error);
    console.log(`🔧 Attempting to fix JSON issues...`);
    try {
      const fixedJson = fixCommonJSONIssues(cleanAIResponse(otherResponse));
      otherData = JSON.parse(fixedJson);
      console.log(`✅ Fixed JSON successfully`);
    } catch (fixError) {
      console.error(`❌ JSON fix also failed:`, fixError);
      console.log(`🔍 Raw response preview:`, otherResponse.substring(0, 500));
      console.log(`🔍 Cleaned response preview:`, cleanAIResponse(otherResponse).substring(0, 500));
      throw new Error(`Failed to parse non-essay questions: ${error.message}`);
    }
  }
  
  try {
    const cleanedEssayResponse = cleanAIResponse(essayResponse);
    console.log(`📝 Cleaned essay questions response (${cleanedEssayResponse.length} chars)`);
    essayData = JSON.parse(cleanedEssayResponse);
  } catch (error) {
    console.error(`❌ Failed to parse essay questions JSON:`, error);
    console.log(`🔧 Attempting to fix JSON issues...`);
    try {
      const fixedJson = fixCommonJSONIssues(cleanAIResponse(essayResponse));
      essayData = JSON.parse(fixedJson);
      console.log(`✅ Fixed JSON successfully`);
    } catch (fixError) {
      console.error(`❌ JSON fix also failed:`, fixError);
      console.log(`🔍 Raw response preview:`, essayResponse.substring(0, 500));
      console.log(`🔍 Cleaned response preview:`, cleanAIResponse(essayResponse).substring(0, 500));
      throw new Error(`Failed to parse essay questions: ${error.message}`);
    }
  }

  // Combine all questions
  const allQuestions = [...otherData.questions, ...essayData.questions];

  // Validate we have the right number of questions
  if (allQuestions.length !== totalQuestions) {
    console.warn(`Expected ${totalQuestions} questions but got ${allQuestions.length}. Proceeding with generated questions.`);
  }

  // Create questions in the database
  for (let i = 0; i < allQuestions.length; i++) {
    const questionData = allQuestions[i];
    
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
    
    await prisma.finalExamQuestionBank.create({
      data: {
        courseId,
        questionType: questionType as any,
        questionText: questionData.question,
        optionsJson: questionData.options || null,
        correctAnswer: questionData.correctAnswer,
        explanation: questionData.explanation,
        points: 1.0,
      },
    });
  }

  console.log(`✅ Question bank generated successfully for course ${courseId} - ${allQuestions.length} questions created`);
  return { success: true, questionCount: allQuestions.length };
}

// Helper function to clean AI responses
function cleanAIResponse(response: string): string {
  let cleanedResponse = response.trim();
  
  // Remove markdown code block wrappers if present
  if (cleanedResponse.startsWith('```json\n') && cleanedResponse.endsWith('\n```')) {
    cleanedResponse = cleanedResponse.slice(8, -4).trim();
  } else if (cleanedResponse.startsWith('```json') && cleanedResponse.endsWith('```')) {
    cleanedResponse = cleanedResponse.slice(7, -3).trim();
  } else if (cleanedResponse.startsWith('```\n') && cleanedResponse.endsWith('\n```')) {
    cleanedResponse = cleanedResponse.slice(4, -4).trim();
  } else if (cleanedResponse.startsWith('```') && cleanedResponse.endsWith('```')) {
    cleanedResponse = cleanedResponse.slice(3, -3).trim();
  }
  
  // Additional cleaning: remove any remaining backticks at start/end
  while (cleanedResponse.startsWith('`') || cleanedResponse.endsWith('`')) {
    if (cleanedResponse.startsWith('`')) {
      cleanedResponse = cleanedResponse.slice(1);
    }
    if (cleanedResponse.endsWith('`')) {
      cleanedResponse = cleanedResponse.slice(0, -1);
    }
    cleanedResponse = cleanedResponse.trim();
  }
  
  // Try to find JSON content if still wrapped
  const jsonStart = cleanedResponse.indexOf('{');
  const jsonEnd = cleanedResponse.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart < jsonEnd) {
    cleanedResponse = cleanedResponse.slice(jsonStart, jsonEnd + 1);
  }
  
  return cleanedResponse;
}

// Helper function to fix common JSON issues
function fixCommonJSONIssues(jsonString: string): string {
  let fixed = jsonString;
  
  // Remove trailing commas before } or ]
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  
  // Fix unescaped quotes in strings (basic attempt)
  // This is a simple fix - more complex scenarios might need better handling
  fixed = fixed.replace(/([^\\])"([^",\]}]*)"([^,\]}\s])/g, '$1\\"$2\\"$3');
  
  // Ensure proper closing of arrays/objects
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  
  // Add missing closing braces/brackets
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += '}';
  }
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += ']';
  }
  
  return fixed;
}

async function generateFinalExam(courseId: string, context?: any) {
  console.log(`🎓 Generating final exam for course ${courseId}`);
  
  const course = await prisma.course.findUnique({
    where: { courseId },
    include: {
      sections: {
        include: {
          articles: {
            where: {
              contentHtml: { not: null },
            },
            orderBy: { orderIndex: 'asc' },
          },
        },
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  if (!course || course.sections.length === 0) {
    throw new Error('Course not found or has no sections with content');
  }

  // Check for existing final exam and delete it only if regenerating
  const existingQuiz = await prisma.courseQuiz.findFirst({
    where: {
      courseId,
      quizType: 'final_exam',
    },
  });

  // Only delete existing quiz if this is a regeneration operation
  const regenerateOnly = context?.regenerateOnly || false;
  if (existingQuiz && regenerateOnly) {
    console.log(`📝 Deleting existing final exam ${existingQuiz.quizId} before regenerating`);
    await prisma.courseQuiz.delete({
      where: { quizId: existingQuiz.quizId },
    });
  } else if (existingQuiz && !regenerateOnly) {
    console.log(`📝 Final exam already exists for ${courseId}, skipping generation`);
    return { success: true, skipped: true, quizId: existingQuiz.quizId };
  }

  // Get quiz generation settings
  const settings = await prisma.quizGenerationSettings.findFirst({
    where: { settingsId: 'default' },
  });
  
  // Get course completion settings for pass mark
  const completionSettings = await prisma.courseCompletionSettings.findFirst({
    where: { settingsId: 'default' },
  });

  const minQuestions = settings?.finalExamMinQuestions || 15;
  const maxQuestions = settings?.finalExamMaxQuestions || 25;
  const questionCount = Math.floor(Math.random() * (maxQuestions - minQuestions + 1)) + minQuestions;

  // Aggregate content from all sections and articles
  const courseContent = course.sections
    .map(section => {
      const articlesContent = section.articles
        .map(article => `Article: ${article.title}\n${article.contentHtml?.substring(0, 800)}...`)
        .join('\n');
      return `Section: ${section.title}\n${section.description || ''}\n${articlesContent}`;
    })
    .join('\n\n');

  const prompt = `Generate a comprehensive final exam for this entire course.

Course: ${course.title} (${course.level} level)
Course Description: ${course.description}
Number of Sections: ${course.sections.length}
Total Articles: ${course.sections.reduce((total, section) => total + section.articles.length, 0)}

Course Content Overview:
${courseContent.substring(0, 8000)}...

Create ${questionCount} questions that:
- Test comprehensive understanding of the ENTIRE course
- Cover key concepts from ALL sections
- Include a mix of question types (emphasis on multiple choice and conceptual questions)
- Are challenging enough for a final exam
- Test both theoretical understanding and practical application
- Are appropriate for ${course.level.toLowerCase()} level learners

IMPORTANT: Use exactly these question type values:
- "MULTIPLE_CHOICE" for multiple choice questions
- "TRUE_FALSE" for true/false questions  
- "FILL_IN_BLANK" for fill in the blank questions (NOT "FILL_IN_THE_BLANK")
- "ESSAY" for essay questions (use sparingly)

Return the response as a JSON object with this structure:
{
  "title": "Final Exam Title",
  "description": "Brief description of what this final exam covers",
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
    courseId,
    courseTitle: course.title,
    courseLevel: course.level,
    examType: 'final_exam',
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
  
  const examData = JSON.parse(cleanedResponse);

  // Create the final exam quiz
  const quiz = await prisma.courseQuiz.create({
    data: {
      courseId,
      title: examData.title || `${course.title} - Final Exam`,
      description: examData.description || `Comprehensive final exam for ${course.title}`,
      quizType: 'final_exam',
      passMarkPercentage: completionSettings?.minQuizAverage || 65.0,
      timeLimit: Math.max(60, questionCount * 3), // 3 minutes per question, minimum 60 minutes
      maxAttempts: null, // Unlimited attempts but with cooldown
      cooldownHours: completionSettings?.finalExamCooldownHours || 24,
    },
  });

  // Create questions
  for (let i = 0; i < examData.questions.length; i++) {
    const questionData = examData.questions[i];
    
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

  console.log(`✅ Final exam generated successfully for course ${courseId}`);
  return { success: true, quizId: quiz.quizId };
}

// Create the worker with proper backoff strategy configuration
export const courseGenerationWorker = new Worker('course-generation', processCourseGenerationJob, {
  connection: connection.duplicate(),
  concurrency: 1, // Reduce concurrency to 1 to prevent overwhelming APIs
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
  settings: {
    // Register the custom backoff strategy that handles rate limits
    backoffStrategy: (attemptsMade: number, type: string, err?: Error, job?: Job) => {
      console.log(`🔄 Custom backoff strategy called: attempt ${attemptsMade}, type: ${type}`);
      if (err) {
        console.log(`   Error type: ${err.constructor.name}, message: ${err.message}`);
      }
      const delay = customBackoffStrategy(attemptsMade, type, err);
      console.log(`   Calculated delay: ${delay}ms (${delay / 1000}s)`);
      return delay;
    },
  },
});

courseGenerationWorker.on('completed', (job) => {
  console.log(`🎓 Course generation job ${job.id} completed`);
});

courseGenerationWorker.on('failed', (job, err) => {
  if (err instanceof RateLimitError) {
    console.log(`🚫 Course generation job ${job?.id} failed due to rate limit. Will retry automatically.`);
    console.log(`   Provider: ${err.provider}, Model: ${err.modelId}, Retry after: ${err.retryAfter}s`);
  } else {
    console.error(`❌ Course generation job ${job?.id} failed:`, err);
  }
});

// Add event listener for job retries
courseGenerationWorker.on('retries-exhausted', (job, err) => {
  console.error(`🔄 Course generation job ${job?.id} exhausted all retries:`, err);
});

// Add event listener for job delays (backoff)
courseGenerationWorker.on('delayed', (job, delay) => {
  console.log(`⏰ Course generation job ${job.id} delayed by ${delay}ms due to backoff strategy`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down course generation worker...');
  await courseGenerationWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});