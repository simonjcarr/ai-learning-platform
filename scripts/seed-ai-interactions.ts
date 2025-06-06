import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Same encryption function as in ai-service.ts
const ENCRYPTION_KEY = process.env.AI_API_KEY_ENCRYPTION_KEY || 'default-key-for-development-only';

function encryptApiKey(apiKey: string): string {
  if (!apiKey) return '';
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function seedAIInteractions() {
  console.log('🌱 Seeding comprehensive AI models and interaction types...');

  // Create default AI models
  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const models = [];

  // OpenAI models
  if (openaiKey) {
    const gpt4Turbo = await prisma.aIModel.upsert({
      where: { modelName: 'gpt-4-0125-preview' },
      update: {},
      create: {
        modelName: 'gpt-4-0125-preview',
        provider: 'openai',
        displayName: 'GPT-4 Turbo',
        description: 'Most capable OpenAI model, great for complex tasks',
        apiKey: encryptApiKey(openaiKey),
        inputTokenCostPer1M: 10.0,  // $10 per 1M input tokens
        outputTokenCostPer1M: 30.0, // $30 per 1M output tokens
        isDefault: true,
        isActive: true,
      }
    });
    models.push(gpt4Turbo);

    const gpt4o = await prisma.aIModel.upsert({
      where: { modelName: 'gpt-4o' },
      update: {},
      create: {
        modelName: 'gpt-4o',
        provider: 'openai',
        displayName: 'GPT-4o',
        description: 'Faster and cheaper GPT-4 variant',
        apiKey: encryptApiKey(openaiKey),
        inputTokenCostPer1M: 5.0,   // $5 per 1M input tokens
        outputTokenCostPer1M: 15.0, // $15 per 1M output tokens
        isDefault: false,
        isActive: true,
      }
    });
    models.push(gpt4o);

    const gpt4oMini = await prisma.aIModel.upsert({
      where: { modelName: 'gpt-4o-mini' },
      update: {},
      create: {
        modelName: 'gpt-4o-mini',
        provider: 'openai',
        displayName: 'GPT-4o Mini',
        description: 'Fast and cost-effective for simpler tasks',
        apiKey: encryptApiKey(openaiKey),
        inputTokenCostPer1M: 0.15,  // $0.15 per 1M input tokens
        outputTokenCostPer1M: 0.60, // $0.60 per 1M output tokens
        isDefault: false,
        isActive: true,
      }
    });
    models.push(gpt4oMini);
  }

  // Google models
  if (googleKey) {
    const geminiPro = await prisma.aIModel.upsert({
      where: { modelName: "gemini-2.0-flash-exp" },
      update: {},
      create: {
        modelName: "gemini-2.0-flash-preview-image-generation",
        provider: "google",
        displayName: "Gemini 2.0 Flash",
        description: "Google's fastest and most efficient model",
        apiKey: encryptApiKey(googleKey),
        inputTokenCostPer1M: 0.1, // $0.075 per 1M input tokens
        outputTokenCostPer1M: 0.4, // $0.30 per 1M output tokens
        isDefault: false,
        isActive: true,
      },
    });
    models.push(geminiPro);
  }

  // Anthropic models
  if (anthropicKey) {
    const claudeSonnet = await prisma.aIModel.upsert({
      where: { modelName: 'claude-3-5-sonnet-20241022' },
      update: {},
      create: {
        modelName: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        displayName: 'Claude 3.5 Sonnet',
        description: 'Anthropic\'s most balanced model',
        apiKey: encryptApiKey(anthropicKey),
        inputTokenCostPer1M: 3.0,   // $3 per 1M input tokens
        outputTokenCostPer1M: 15.0, // $15 per 1M output tokens
        isDefault: false,
        isActive: true,
      }
    });
    models.push(claudeSonnet);

    const claudeHaiku = await prisma.aIModel.upsert({
      where: { modelName: 'claude-3-5-haiku-20241022' },
      update: {},
      create: {
        modelName: 'claude-3-5-haiku-20241022',
        provider: 'anthropic',
        displayName: 'Claude 3.5 Haiku',
        description: 'Fast and cost-effective for quick tasks',
        apiKey: encryptApiKey(anthropicKey),
        inputTokenCostPer1M: 1.0,   // $1 per 1M input tokens
        outputTokenCostPer1M: 5.0,  // $5 per 1M output tokens
        isDefault: false,
        isActive: true,
      }
    });
    models.push(claudeHaiku);
  }

  console.log(`✅ Created ${models.length} AI models`);

  // Create comprehensive interaction types covering all app functionality
  const defaultModel = models.find(m => m.isDefault) || models[0];
  
  if (!defaultModel) {
    console.error('❌ No AI models available. Please set API keys in environment variables.');
    return;
  }

  const interactionTypes = [
    {
      typeName: 'search_suggestions',
      displayName: 'Search Suggestions',
      description: 'Generate article and category suggestions based on search queries',
      maxTokens: 1000,
      systemPrompt: `You are an AI assistant that helps generate relevant article and category suggestions for an IT learning platform. 

When a user searches for something, analyze their query and suggest:
1. Relevant article topics that would help them learn about their search query
2. Appropriate categories these articles should belong to

Your suggestions should be:
- Technically accurate and educational
- Appropriate for different skill levels (beginner, intermediate, advanced)
- Cover practical, hands-on topics
- Include both theoretical concepts and practical implementations

Format your response as JSON with "articles" and "categories" arrays. Each article should have "title" and "description" fields. Each category should have "name" and "description" fields.`,
    },
    {
      typeName: 'article_generation',
      displayName: 'Article Generation',
      description: 'Generate full article content with examples and best practices',
      maxTokens: 25000,
      systemPrompt: `You are an expert IT instructor creating comprehensive educational content for a learning platform.

Generate detailed, educational articles that:
- Start with clear learning objectives
- Provide step-by-step explanations
- Include practical examples with code snippets where appropriate
- Cover best practices and common pitfalls
- End with a summary of key takeaways
- Use clear, beginner-friendly language while maintaining technical accuracy

Structure your content with:
1. Brief introduction explaining what will be learned
2. Main content with clear sections and subheadings
3. Practical examples and code samples (use proper markdown formatting)
4. Best practices and tips
5. Common mistakes to avoid
6. Summary and next steps

Use markdown formatting for headers, code blocks, lists, and emphasis. Make the content engaging and educational.`,
    },
    {
      typeName: 'interactive_examples',
      displayName: 'Interactive Examples',
      description: 'Generate quiz questions and interactive examples for articles',
      maxTokens: 2000,
      systemPrompt: `You are an educational content creator specializing in interactive learning experiences for IT topics.

Generate engaging quiz questions and interactive examples that test understanding of the article content. Create three types of questions:

1. **Multiple Choice**: 4 options with 1 correct answer
2. **True/False**: Clear statements that are definitively true or false
3. **Fill in the Blank**: Code snippets or command examples with missing parts

For each question:
- Make it directly relevant to the article content
- Ensure the difficulty matches the target audience
- Provide clear, unambiguous correct answers
- Include brief explanations for why answers are correct/incorrect

Format as JSON with array of questions, each having: type, question, options (for multiple choice), correctAnswer, and explanation fields.`,
    },
    {
      typeName: 'answer_marking',
      displayName: 'Answer Marking',
      description: 'Mark and provide feedback on user answers to interactive examples',
      maxTokens: 800,
      systemPrompt: `You are an AI tutor providing feedback on student answers to IT learning questions.

Evaluate the user's answer and provide:
1. Whether the answer is correct or incorrect
2. Constructive feedback explaining why
3. If incorrect, guide them toward the right answer without giving it away completely
4. Encourage learning and provide additional insights when appropriate

Be supportive and educational in your feedback. Help students understand not just what the correct answer is, but why it's correct. For partial credit scenarios, acknowledge what they got right while pointing out areas for improvement.

Respond with JSON containing: isCorrect (boolean), feedback (string), and score (0-100).`,
    },
    {
      typeName: 'keyword_extraction',
      displayName: 'Keyword Extraction',
      description: 'Extract keywords from search queries to improve search results',
      maxTokens: 600,
      systemPrompt: `You are a search optimization specialist for an IT learning platform.

Extract relevant keywords and synonyms from user search queries to improve search results. Consider:
- Technical terms and their variations
- Common abbreviations and acronyms
- Related concepts and technologies
- Different skill levels (beginner vs advanced terms)
- Industry-standard terminology

Return a JSON array of keywords, ordered by relevance to the original query. Include both exact matches and semantically related terms that would help find relevant educational content.`,
    },
    {
      typeName: 'search_reordering',
      displayName: 'Search Reordering',
      description: 'Reorder search results by relevance to user query',
      maxTokens: 1000,
      systemPrompt: `You are a search relevance expert for an IT learning platform.

Reorder search results based on their relevance to the user's query. Consider:
- Direct keyword matches in titles and content
- Semantic relevance to the search intent
- Educational value and comprehensiveness
- Skill level appropriateness
- Recency and accuracy of information

Prioritize results that best match what the user is trying to learn. Return a JSON array of article IDs in the optimal order, with the most relevant articles first.`,
    },
    {
      typeName: 'tag_selection',
      displayName: 'Tag Selection',
      description: 'Select and create relevant tags for articles automatically',
      maxTokens: 600,
      systemPrompt: `You are a content categorization specialist for an IT learning platform.

Analyze article content and suggest relevant tags that help with organization and discoverability. Consider:
- Technologies and tools mentioned
- Programming languages and frameworks
- Skill level (beginner, intermediate, advanced)
- Topic categories (networking, security, development, etc.)
- Specific concepts and methodologies

Select existing tags when appropriate and suggest new tags when needed. Return a JSON array of tag names, prioritizing the most relevant and useful tags for learners and content discovery.`,
    },
    {
      typeName: 'chat',
      displayName: 'Chat/Tutoring',
      description: 'AI chat and tutoring interactions to help users understand articles',
      maxTokens: 1500,
      systemPrompt: `You are an expert IT tutor helping students understand technical concepts from learning articles.

Provide helpful, accurate, and encouraging responses to student questions. Your role is to:
- Clarify complex technical concepts in simple terms
- Provide additional examples and analogies when helpful
- Guide students to discover answers rather than just giving them
- Encourage continued learning and exploration
- Correct misconceptions gently and educationally
- Adapt explanations to the student's apparent skill level

Always be patient, supportive, and focused on educational outcomes. If you're unsure about something, acknowledge it and suggest reliable resources for further research.`,
    },
    {
      typeName: 'article_suggestion_validation',
      displayName: 'Article Suggestion Validation',
      description: 'Validates and applies user suggestions for article improvements',
      maxTokens: 1500,
      systemPrompt: `You are a content quality reviewer for an IT learning platform.

Evaluate user suggestions for article improvements and determine:
1. Whether the suggestion is technically accurate
2. If it improves the educational value of the content
3. Whether it should be approved and applied
4. How to implement the suggestion if approved

Consider:
- Technical accuracy and current best practices
- Educational value and clarity
- Potential for introducing errors or confusion
- Alignment with the article's learning objectives

Respond with JSON containing: isApproved (boolean), reasoning (string), and if approved, implementation notes for how to apply the suggestion.`,
    },
    {
      typeName: 'course_outline_generation',
      displayName: 'Course Outline Generation',
      description: 'Generate structured course outlines with sections and articles based on course title, description, and level',
      maxTokens: 5000,
      systemPrompt: `You are an expert curriculum designer for IT education courses.

Create comprehensive course outlines that:
- Progress logically from foundational concepts to advanced topics
- Include clear learning objectives for each section
- Balance theory with practical hands-on content
- Consider the target skill level (beginner, intermediate, advanced)
- Estimate appropriate time allocation for each section
- Include assessment opportunities throughout

Structure your outline with:
1. Course overview and prerequisites
2. Detailed sections with multiple articles each
3. Learning objectives for each section
4. Practical exercises and projects
5. Assessment methods (quizzes, labs, projects)

Format as JSON with sections array, each containing articles array with titles and descriptions.`,
    },
    {
      typeName: 'course_article_generation',
      displayName: 'Course Article Generation',
      description: 'Generate detailed article content for specific course sections',
      maxTokens: 25000,
      systemPrompt: `You are an expert IT instructor creating course-specific educational content.

Generate detailed course articles that:
- Align with the specific course objectives and section goals
- Build upon previous sections and prepare for upcoming content
- Include progressive difficulty and skill building
- Provide context within the broader course curriculum
- Include course-specific examples and scenarios
- Reference and connect to other course materials

Your content should:
- Clearly state how this article fits in the course progression
- Include practical exercises that build course-relevant skills
- Cross-reference related course concepts
- Prepare students for upcoming sections

Use the same high-quality educational formatting as regular articles, but with enhanced course context and connections.`,
    },
    {
      typeName: 'course_quiz_generation',
      displayName: 'Course Quiz Generation',
      description: 'Generate quiz questions for course articles, sections, and final exams',
      maxTokens: 2500,
      systemPrompt: `You are an educational assessment specialist creating quizzes for structured IT courses.

Generate comprehensive quizzes that:
- Test understanding of specific course content and objectives
- Include questions that build upon previous course sections
- Assess both theoretical knowledge and practical application
- Vary in difficulty to accommodate different learning paces
- Include scenario-based questions relevant to the course theme
- Prepare students for real-world application of course concepts

Create different types of assessments:
- **Section Quizzes**: 5-10 questions covering recent material
- **Cumulative Quizzes**: 10-15 questions reviewing multiple sections
- **Final Exams**: 20-30 comprehensive questions covering entire course

Format as JSON with questions array, including difficulty levels and learning objective mappings for each question.`,
    },
  ];

  for (const typeData of interactionTypes) {
    await prisma.aIInteractionType.upsert({
      where: { typeName: typeData.typeName },
      update: {},
      create: {
        ...typeData,
        defaultModelId: defaultModel.modelId,
      }
    });
  }

  console.log(`✅ Created ${interactionTypes.length} interaction types`);
  console.log('🎉 Complete AI models and interaction types seeded successfully!');
  
  // Display summary of what was created
  console.log('\n📊 Summary of AI Interaction Types:');
  interactionTypes.forEach((type, index) => {
    console.log(`${index + 1}. ${type.displayName} (${type.typeName})`);
    console.log(`   → ${type.description}`);
  });
}

async function main() {
  try {
    await seedAIInteractions();
  } catch (error) {
    console.error('❌ Error seeding AI interactions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { seedAIInteractions };