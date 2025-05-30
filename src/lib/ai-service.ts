import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { prisma } from './prisma';
import crypto from 'crypto';
import { createPatch } from 'diff';

// Encryption key for API keys (in production, use a proper key management service)
const ENCRYPTION_KEY = process.env.AI_API_KEY_ENCRYPTION_KEY || 'default-key-for-development-only';

// Utility functions for API key encryption/decryption
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

function decryptApiKey(encryptedApiKey: string): string {
  if (!encryptedApiKey) return '';
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const parts = encryptedApiKey.split(':');
    if (parts.length !== 2) return '';
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return '';
  }
}

// Initialize providers with database models
async function createProviderForModel(modelId: string) {
  const model = await prisma.aIModel.findUnique({
    where: { modelId, isActive: true }
  });
  
  if (!model) {
    throw new Error(`Model ${modelId} not found or inactive`);
  }
  
  const apiKey = decryptApiKey(model.apiKey);
  if (!apiKey) {
    throw new Error(`No API key found for model ${modelId}`);
  }
  
  switch (model.provider) {
    case 'openai':
      return createOpenAI({ apiKey })(model.modelName);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(model.modelName);
    case 'anthropic':
      return createAnthropic({ apiKey })(model.modelName);
    default:
      throw new Error(`Unsupported provider: ${model.provider}`);
  }
}

// Get model for specific interaction type
async function getModelForInteraction(interactionTypeName: string) {
  const interactionType = await prisma.aIInteractionType.findUnique({
    where: { typeName: interactionTypeName },
    include: { defaultModel: true }
  });
  
  if (!interactionType?.defaultModel) {
    // Fallback to any active default model
    const defaultModel = await prisma.aIModel.findFirst({
      where: { isActive: true, isDefault: true }
    });
    
    if (!defaultModel) {
      throw new Error(`No active model found for interaction type: ${interactionTypeName}`);
    }
    
    return { model: defaultModel, interactionType };
  }
  
  return { model: interactionType.defaultModel, interactionType };
}

// Track AI interaction
async function trackAIInteraction(
  modelId: string,
  interactionTypeId: string,
  clerkUserId: string | null,
  inputTokens: number,
  outputTokens: number,
  startTime: Date,
  endTime: Date,
  contextData?: any,
  prompt?: string,
  response?: string,
  errorMessage?: string
) {
  const model = await prisma.aIModel.findUnique({
    where: { modelId }
  });
  
  if (!model) {
    console.error(`Model ${modelId} not found for tracking`);
    return;
  }
  
  const inputCost = (inputTokens / 1000000) * Number(model.inputTokenCostPer1M);
  const outputCost = (outputTokens / 1000000) * Number(model.outputTokenCostPer1M);
  const totalCost = inputCost + outputCost;
  
  const durationMs = endTime.getTime() - startTime.getTime();
  
  try {
    await prisma.aIInteraction.create({
      data: {
        modelId,
        interactionTypeId,
        clerkUserId,
        inputTokens,
        outputTokens,
        inputTokenCost: inputCost,
        outputTokenCost: outputCost,
        totalCost: totalCost,
        prompt: prompt?.substring(0, 5000), // Limit prompt length for storage
        response: response?.substring(0, 10000), // Limit response length for storage
        contextData,
        startedAt: startTime,
        completedAt: endTime,
        durationMs,
        isSuccessful: !errorMessage,
        errorMessage
      }
    });
  } catch (error) {
    console.error('Failed to track AI interaction:', error);
  }
}

// Schema definitions for structured outputs
export const CategorySuggestionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export const ArticleSuggestionSchema = z.object({
  title: z.string(),
  target_category_names: z.array(z.string()).min(1),
  primary_category_name: z.string(),
});

export const AISearchResponseSchema = z.object({
  suggested_new_categories: z.array(CategorySuggestionSchema),
  suggested_new_article_titles: z.array(ArticleSuggestionSchema),
});

export const InteractiveExampleSchema = z.object({
  question_type: z.enum(['multiple_choice', 'text_input', 'command_line']),
  scenario_or_question_text: z.string(),
  options_json: z.array(z.object({
    id: z.string(),
    text: z.string(),
  })).optional(),
  correct_answer_key_or_text: z.string(),
  correct_answer_description: z.string(),
  ai_marking_prompt_hint: z.string().optional(),
});

export const ExampleGenerationResponseSchema = z.object({
  examples: z.array(InteractiveExampleSchema),
});

export const MarkingResponseSchema = z.object({
  is_correct: z.boolean(),
  feedback: z.string(),
});

export const ReorderResultsSchema = z.object({
  reordered_article_ids: z.array(z.string()),
  explanation: z.string().optional(),
});

export const KeywordExtractionSchema = z.object({
  keywords: z.array(z.string()),
  search_intent: z.string(),
  suggested_search_terms: z.array(z.string()),
});

export const TagSuggestionSchema = z.object({
  tagName: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
});

export const TagSelectionResponseSchema = z.object({
  existing_tags: z.array(z.string()), // Tag IDs of existing tags to use
  new_tags: z.array(TagSuggestionSchema), // New tags to create
  explanation: z.string().optional(),
});

export const ArticleSuggestionValidationSchema = z.object({
  isValid: z.boolean(),
  reason: z.string(),
  updatedContent: z.string().nullable(),
  diff: z.string().nullable(),
  description: z.string().nullable(),
});

// Enhanced AI Service functions with database tracking
export const aiService = {
  async generateSearchSuggestions(query: string, allCategories: { categoryName: string; description: string | null }[], existingArticles: { title: string; category: string }[], articlesToGenerate: number = 5, clerkUserId: string | null = null) {
    const systemPrompt = `You are an AI assistant helping users find and discover IT-related content. Based on their search query, suggest relevant categories and article titles that would be helpful. 

IMPORTANT: 
1. Articles can belong to MULTIPLE categories. Assign articles to ALL relevant categories, not just one.
2. When suggesting articles, you MUST prefer using existing categories whenever possible. Only suggest new categories if none of the existing categories are appropriate.
3. Keep category names GENERIC and SIMPLE (e.g., "Docker", "Kubernetes", "Python", "Programming", NOT "Docker Basics" or "Advanced Python")
4. Be precise about technology distinctions - Docker and Docker Swarm are different, Kubernetes and OpenShift are different, etc.
5. Consider fundamental categories like "Programming", "DevOps", "Security", "Networking", etc. for articles that fit these broader topics.`;
    
    const userPrompt = `User's search query: "${query}"
    
ALL EXISTING CATEGORIES in the system (use these whenever possible):
${allCategories.map(cat => `- ${cat.categoryName}${cat.description ? `: ${cat.description}` : ''}`).join('\n')}

Existing articles related to this search: ${JSON.stringify(existingArticles)}

Please suggest exactly ${articlesToGenerate} new article titles that would be helpful for this search.

SPECIAL ATTENTION FOR "HOW TO" QUESTIONS:
If the user's query is a specific "how to" question (like "How to reclaim space used by docker"), prioritize creating articles that DIRECTLY answer that specific question with practical steps and commands.

CRITICAL RULES:
1. Each article should have MULTIPLE categories:
   - target_category_names: An array of ALL relevant category names
   - primary_category_name: The MOST specific/relevant category (from target_category_names)
2. For each article, assign it to ALL applicable categories:
   - The specific technology category (e.g., "LISP", "Python", "Docker")
   - Fundamental categories (e.g., "Programming", "DevOps", "AI")
   - Domain categories if applicable (e.g., "Web Development", "Data Science")
3. Use exact category names from the list above when they exist
4. Only suggest new categories if essential (especially for fundamental categories like "Programming")
5. NEW CATEGORY NAMES MUST BE:
   - Generic and simple (e.g., "Programming", "Docker Swarm", not "Docker Swarm Basics")
   - Just the technology/tool/domain name without qualifiers
   - Distinct from related technologies
6. If suggesting a new category, provide a clear description
7. Don't suggest article titles that already exist
8. Articles must be SPECIFICALLY about the searched technology
9. For "how to" queries, create titles that directly address the specific task

EXAMPLE: An article about "LISP Programming Tutorial" should have:
- target_category_names: ["LISP", "Programming", "AI"] (if AI category exists and is relevant)
- primary_category_name: "LISP" (most specific)`;

    const startTime = new Date();
    let result, error;
    
    try {
      const { model, interactionType } = await getModelForInteraction('search_suggestions');
      const aiModel = await createProviderForModel(model.modelId);
      
      result = await generateObject({
        model: aiModel,
        system: systemPrompt,
        prompt: userPrompt,
        schema: AISearchResponseSchema,
        temperature: 0.7,
        maxTokens: 1000,
      });
      
      const endTime = new Date();
      
      // Track the interaction
      await trackAIInteraction(
        model.modelId,
        interactionType.typeId,
        clerkUserId,
        result.usage?.promptTokens || 0,
        result.usage?.completionTokens || 0,
        startTime,
        endTime,
        { query, categoriesCount: allCategories.length, articlesCount: existingArticles.length },
        userPrompt,
        JSON.stringify(result.object)
      );
      
      return result.object;
    } catch (err) {
      error = err;
      const endTime = new Date();
      
      // Try to get model info for error tracking
      try {
        const { model, interactionType } = await getModelForInteraction('search_suggestions');
        await trackAIInteraction(
          model.modelId,
          interactionType.typeId,
          clerkUserId,
          0,
          0,
          startTime,
          endTime,
          { query, categoriesCount: allCategories.length, articlesCount: existingArticles.length },
          userPrompt,
          undefined,
          String(err)
        );
      } catch (trackingError) {
        console.error('Failed to track error:', trackingError);
      }
      
      throw error;
    }
  },

  async generateArticleContent(title: string, categoryName: string, clerkUserId: string | null = null) {
    const systemPrompt = `You are an expert IT technical writer. Create comprehensive, detailed articles in Markdown format with proper headings, code examples, and clear explanations. Include practical examples and real-world scenarios. 

IMPORTANT: Output pure Markdown content only. Do NOT wrap the entire response in code blocks. Start directly with the article title using # heading.`;
    
    const userPrompt = `Write a comprehensive IT article about "${title}" in the category "${categoryName}".

Requirements:
1. Start directly with the title using # (h1 heading)
2. Use proper Markdown formatting with # for h1, ## for h2, etc.
3. Include code examples with proper syntax highlighting (use triple backticks with language specification for code blocks ONLY)
4. Add practical examples and real-world use cases
5. Structure with clear sections: Introduction, Key Concepts, Examples, Best Practices, Common Issues, Conclusion
6. Make it educational and practical for IT professionals
7. Include command-line examples where relevant
8. Aim for 1500-2500 words of high-quality content

Remember: Output raw Markdown text, NOT wrapped in any code blocks.`;

    const startTime = new Date();
    let result, error;
    
    try {
      const { model, interactionType } = await getModelForInteraction('article_generation');
      const aiModel = await createProviderForModel(model.modelId);
      
      result = await generateText({
        model: aiModel,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
        maxTokens: 4000,
      });

      const endTime = new Date();
      
      // Clean up any accidental code block wrappers
      let content = result.text.trim();
      if (content.startsWith('```markdown\n') && content.endsWith('\n```')) {
        content = content.slice(12, -4).trim();
      } else if (content.startsWith('```\n') && content.endsWith('\n```')) {
        content = content.slice(4, -4).trim();
      }
      
      // Track the interaction
      await trackAIInteraction(
        model.modelId,
        interactionType.typeId,
        clerkUserId,
        result.usage?.promptTokens || 0,
        result.usage?.completionTokens || 0,
        startTime,
        endTime,
        { title, categoryName },
        userPrompt,
        content
      );

      return {
        title,
        content,
        metaDescription: `Learn about ${title} in ${categoryName}. Comprehensive guide with examples and best practices.`
      };
    } catch (err) {
      error = err;
      const endTime = new Date();
      
      // Try to get model info for error tracking
      try {
        const { model, interactionType } = await getModelForInteraction('article_generation');
        await trackAIInteraction(
          model.modelId,
          interactionType.typeId,
          clerkUserId,
          0,
          0,
          startTime,
          endTime,
          { title, categoryName },
          userPrompt,
          undefined,
          String(err)
        );
      } catch (trackingError) {
        console.error('Failed to track error:', trackingError);
      }
      
      throw error;
    }
  },

  async generateInteractiveExamples(articleTitle: string, categoryName: string, existingQuestions: string[], clerkUserId: string | null = null) {
    const systemPrompt = `You are an IT education expert creating interactive examples. Generate diverse, practical questions that test real understanding. Focus on real-world scenarios that IT professionals would encounter.`;
    
    const userPrompt = `Based on the IT article titled "${articleTitle}" in the category "${categoryName}", generate 3-5 unique interactive examples to test understanding.

${existingQuestions.length > 0 ? `Avoid these existing questions: ${JSON.stringify(existingQuestions)}` : ''}

For each example:
- Choose question type intelligently from 'multiple_choice', 'text_input', or 'command_line'
- Create practical, real-world scenarios
- For multiple choice, provide 4-5 plausible options with format: {"id": "a", "text": "Option text"}
- Include clear explanations for correct answers
- Add keywords for AI marking (for text/command line questions)`;

    const startTime = new Date();
    let result, error;
    
    try {
      const { model, interactionType } = await getModelForInteraction('interactive_examples');
      const aiModel = await createProviderForModel(model.modelId);
      
      result = await generateObject({
        model: aiModel,
        system: systemPrompt,
        prompt: userPrompt,
        schema: ExampleGenerationResponseSchema,
        temperature: 0.8,
        maxTokens: 2000,
      });
      
      const endTime = new Date();
      
      // Track the interaction
      await trackAIInteraction(
        model.modelId,
        interactionType.typeId,
        clerkUserId,
        result.usage?.promptTokens || 0,
        result.usage?.completionTokens || 0,
        startTime,
        endTime,
        { articleTitle, categoryName, existingQuestionsCount: existingQuestions.length },
        userPrompt,
        JSON.stringify(result.object)
      );
      
      return result.object;
    } catch (err) {
      error = err;
      const endTime = new Date();
      
      try {
        const { model, interactionType } = await getModelForInteraction('interactive_examples');
        await trackAIInteraction(
          model.modelId,
          interactionType.typeId,
          clerkUserId,
          0,
          0,
          startTime,
          endTime,
          { articleTitle, categoryName, existingQuestionsCount: existingQuestions.length },
          userPrompt,
          undefined,
          String(err)
        );
      } catch (trackingError) {
        console.error('Failed to track error:', trackingError);
      }
      
      throw error;
    }
  },

  async markUserAnswer(questionText: string, userAnswer: string, questionType: string, markingHint?: string, clerkUserId: string | null = null) {
    const systemPrompt = `You are an IT education expert marking student answers. Be encouraging but accurate. Provide constructive feedback that helps learning.`;
    
    const userPrompt = `Question: ${questionText}
Question Type: ${questionType}
User's Answer: ${userAnswer}
${markingHint ? `Marking Hint: ${markingHint}` : ''}

Evaluate if the answer is correct and provide helpful feedback. For command line questions, accept reasonable variations (e.g., with or without sudo, different flag orders).`;

    const startTime = new Date();
    let result, error;
    
    try {
      const { model, interactionType } = await getModelForInteraction('answer_marking');
      const aiModel = await createProviderForModel(model.modelId);
      
      result = await generateObject({
        model: aiModel,
        system: systemPrompt,
        prompt: userPrompt,
        schema: MarkingResponseSchema,
        temperature: 0.3,
        maxTokens: 500,
      });
      
      const endTime = new Date();
      
      // Track the interaction
      await trackAIInteraction(
        model.modelId,
        interactionType.typeId,
        clerkUserId,
        result.usage?.promptTokens || 0,
        result.usage?.completionTokens || 0,
        startTime,
        endTime,
        { questionType, hasMarkingHint: !!markingHint },
        userPrompt,
        JSON.stringify(result.object)
      );
      
      return result.object;
    } catch (err) {
      error = err;
      const endTime = new Date();
      
      try {
        const { model, interactionType } = await getModelForInteraction('answer_marking');
        await trackAIInteraction(
          model.modelId,
          interactionType.typeId,
          clerkUserId,
          0,
          0,
          startTime,
          endTime,
          { questionType, hasMarkingHint: !!markingHint },
          userPrompt,
          undefined,
          String(err)
        );
      } catch (trackingError) {
        console.error('Failed to track error:', trackingError);
      }
      
      throw error;
    }
  },

  async extractSearchKeywords(query: string, clerkUserId: string | null = null) {
    const systemPrompt = `You are an AI assistant that analyzes user search queries to extract relevant keywords and understand search intent. Your goal is to help find the most relevant content by identifying key terms and concepts.`;

    const userPrompt = `User's search query: "${query}"

Analyze this query and provide:
1. Key technical keywords that should be searched for in content
2. The overall search intent (what the user is trying to accomplish)
3. Alternative search terms that might be used in technical documentation

Focus on technical terms, commands, concepts, and tools that would likely appear in IT articles addressing this query.

Examples:
- "How to reclaim space used by docker" → keywords: ["docker", "prune", "cleanup", "storage", "disk space", "remove", "images", "containers", "volumes"]
- "Kubernetes troubleshooting" → keywords: ["kubectl", "pods", "services", "debugging", "logs", "events", "status"]`;

    const startTime = new Date();
    
    try {
      const { model, interactionType } = await getModelForInteraction('keyword_extraction');
      const aiModel = await createProviderForModel(model.modelId);
      
      const result = await generateObject({
        model: aiModel,
        system: systemPrompt,
        prompt: userPrompt,
        schema: KeywordExtractionSchema,
        temperature: 0.3,
        maxTokens: 500,
      });
      
      const endTime = new Date();
      
      await trackAIInteraction(
        model.modelId,
        interactionType.typeId,
        clerkUserId,
        result.usage?.promptTokens || 0,
        result.usage?.completionTokens || 0,
        startTime,
        endTime,
        { query },
        userPrompt,
        JSON.stringify(result.object)
      );
      
      return result.object;
    } catch (err) {
      const endTime = new Date();
      try {
        const { model, interactionType } = await getModelForInteraction('keyword_extraction');
        await trackAIInteraction(model.modelId, interactionType.typeId, clerkUserId, 0, 0, startTime, endTime, { query }, userPrompt, undefined, String(err));
      } catch (trackingError) {
        console.error('Failed to track error:', trackingError);
      }
      throw err;
    }
  },

  async reorderSearchResults(query: string, articles: Array<{articleId: string, articleTitle: string, category: {categoryName: string}, isContentGenerated: boolean}>, categories: Array<{categoryId: string, categoryName: string, description: string | null}>, clerkUserId: string | null = null) {
    const systemPrompt = `You are an AI assistant that helps reorder search results based on relevance to the user's query. Your goal is to put the most relevant and helpful content first.

Consider:
1. Direct relevance to the query
2. Level of detail appropriate for the query (beginner vs advanced)
3. Practical usefulness for someone asking this question
4. Logical learning progression (basics before advanced topics)`;

    const userPrompt = `User's search query: "${query}"

Available articles:
${articles.map((article, index) => {
  const categories = article.categories?.map(c => c.category.categoryName).join(', ') || 'No category';
  return `${index + 1}. ID: ${article.articleId}
   Title: ${article.articleTitle}
   Categories: ${categories}
   Status: ${article.isContentGenerated ? 'Ready' : 'Content pending'}`;
}).join('\n\n')}

Available categories:
${categories.map(cat => 
  `- ${cat.categoryName}${cat.description ? `: ${cat.description}` : ''}`
).join('\n')}

Please reorder these articles by relevance to the user's query. Return the article IDs in order from most relevant to least relevant.

Consider what someone searching for "${query}" would most likely want to learn about first.`;

    const startTime = new Date();
    
    try {
      const { model, interactionType } = await getModelForInteraction('search_reordering');
      const aiModel = await createProviderForModel(model.modelId);
      
      const result = await generateObject({
        model: aiModel,
        system: systemPrompt,
        prompt: userPrompt,
        schema: ReorderResultsSchema,
        temperature: 0.3, // Lower temperature for more consistent ordering
        maxTokens: 1000,
      });
      
      const endTime = new Date();
      
      await trackAIInteraction(
        model.modelId,
        interactionType.typeId,
        clerkUserId,
        result.usage?.promptTokens || 0,
        result.usage?.completionTokens || 0,
        startTime,
        endTime,
        { query, articlesCount: articles.length, categoriesCount: categories.length },
        userPrompt,
        JSON.stringify(result.object)
      );
      
      return result.object;
    } catch (err) {
      const endTime = new Date();
      try {
        const { model, interactionType } = await getModelForInteraction('search_reordering');
        await trackAIInteraction(model.modelId, interactionType.typeId, clerkUserId, 0, 0, startTime, endTime, { query, articlesCount: articles.length }, userPrompt, undefined, String(err));
      } catch (trackingError) {
        console.error('Failed to track error:', trackingError);
      }
      throw err;
    }
  },

  async validateArticleSuggestion(articleTitle: string, articleContent: string, suggestionType: string, suggestionDetails: string, clerkUserId: string | null = null) {
    // Check for URLs in the suggestion details first to prevent spam
    const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+|\b[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}\b/gi;
    const containsUrl = urlPattern.test(suggestionDetails);
    
    if (containsUrl) {
      // Immediately reject suggestions containing URLs
      return {
        isValid: false,
        reason: 'Suggestions containing URLs are not allowed to prevent spam. Please describe the improvement without including any links.',
        updatedContent: null,
        diff: null,
        description: null
      };
    }
    
    // Check for references to external websites or resources
    const websiteReferencePattern = /\b(website|site|webpage|web page|blog|portal|platform|resource|link|reference|check out|visit|go to|see|refer to|found at|available at|hosted at|located at)\b.*\b(com|org|net|io|dev|edu|gov|co|uk|ca|au|de|fr|it|es|nl|be|ch|at|se|no|dk|fi|pl|ru|jp|cn|in|br|mx|za)\b/gi;
    const domainNamePattern = /\b(github|gitlab|bitbucket|stackoverflow|medium|reddit|youtube|google|facebook|twitter|linkedin|amazon|microsoft|apple|mozilla|wikipedia|wikimedia|npm|pypi|docker|kubernetes)\b/gi;
    
    if (websiteReferencePattern.test(suggestionDetails) || domainNamePattern.test(suggestionDetails)) {
      return {
        isValid: false,
        reason: 'Suggestions that reference external websites or resources are not allowed. Please describe the improvement using only the content that should be added to the article itself.',
        updatedContent: null,
        diff: null,
        description: null
      };
    }
    
    const systemPrompt = `You are an AI assistant helping to validate and apply user suggestions to educational IT articles. Be concise but thorough.`;
    
    // For very large articles, we might need to be more strategic
    const contentLength = articleContent.length;
    const isLargeArticle = contentLength > 10000;
    
    let processedContent = articleContent;
    if (isLargeArticle && contentLength > 20000) {
      // For extremely large articles, we might need to truncate
      console.log(`Article is very large (${contentLength} chars), processing full content`);
    }
    
    const userPrompt = `Article Title: ${articleTitle}
Current Content (in Markdown format):
${processedContent}

User Suggestion Type: ${suggestionType}
User Suggestion Details: ${suggestionDetails}

Please analyze this suggestion carefully:

1. First, determine if the suggestion is appropriate and valid:
   - Is it relevant to the article's topic and title?
   - Is it technically accurate?
   - Is it appropriate for the article's educational purpose?
   - Does it improve the article's quality or clarity?
   
2. CRITICAL SPAM PREVENTION RULES - Immediately REJECT if the suggestion:
   - Contains ANY URLs, links, or web addresses
   - References ANY external websites, blogs, or online resources
   - Mentions specific website names (GitHub, Stack Overflow, etc.)
   - Asks to add references to external content
   - Suggests visiting, checking out, or referring to any external resource
   - Contains phrases like "see [website]", "refer to [resource]", "check out [site]"
   - Attempts to promote or reference any external platform or service
   
3. If the suggestion is VALID and contains NO external references:
   - Apply the suggested change to the article
   - Return the COMPLETE updated article in Markdown format
   - Ensure all Markdown formatting is preserved (headings, code blocks, lists, etc.)
   - The updated content should include the entire article, not just the changed section
   - Also provide a human-readable description of the change made
   
4. If the suggestion is INVALID:
   - Explain clearly why the suggestion cannot be applied
   - If it references external content, state: "Suggestions referencing external websites or resources are not allowed. Please provide self-contained improvements."

IMPORTANT: 
- The updatedContent field must contain the ENTIRE article in valid Markdown format
- Preserve all existing Markdown formatting (# headings, code blocks with triple backticks, lists, etc.)
- Do not wrap the content in any additional code blocks
- The description should be a concise summary of what was changed
- NEVER add ANY external links, references, or website mentions to the article`;

    const startTime = new Date();
    let result, error;
    
    try {
      const { model, interactionType } = await getModelForInteraction('article_suggestion_validation');
      const aiModel = await createProviderForModel(model.modelId);
      
      // Calculate needed tokens based on article size
      const estimatedOutputTokens = Math.ceil(contentLength / 3) + 1000; // Extra for the added content
      const maxTokensNeeded = Math.min(estimatedOutputTokens, 16000); // Cap at 16k tokens
      
      result = await generateObject({
        model: aiModel,
        system: systemPrompt,
        prompt: userPrompt,
        schema: ArticleSuggestionValidationSchema,
        temperature: 0.3,
        maxTokens: Math.max(maxTokensNeeded, model.maxTokens || 4000),
      });
      
      const endTime = new Date();
      
      // If the suggestion was valid and we have updated content, generate the diff
      if (result.object.isValid && result.object.updatedContent) {
        const diff = createPatch(
          articleTitle,
          articleContent,
          result.object.updatedContent,
          'original',
          'updated'
        );
        result.object.diff = diff;
      }
      
      // Track the interaction
      await trackAIInteraction(
        model.modelId,
        interactionType.typeId,
        clerkUserId,
        result.usage?.promptTokens || 0,
        result.usage?.completionTokens || 0,
        startTime,
        endTime,
        { articleTitle, suggestionType },
        userPrompt,
        JSON.stringify(result.object)
      );
      
      return result.object;
    } catch (err) {
      error = err;
      const endTime = new Date();
      
      // Try to get model info for error tracking
      try {
        const { model, interactionType } = await getModelForInteraction('article_suggestion_validation');
        await trackAIInteraction(
          model.modelId,
          interactionType.typeId,
          clerkUserId,
          0,
          0,
          startTime,
          endTime,
          { articleTitle, suggestionType },
          userPrompt,
          undefined,
          String(err)
        );
      } catch (trackingError) {
        console.error('Failed to track error:', trackingError);
      }
      
      throw error;
    }
  },

  async selectAndCreateTags(articleTitle: string, categoryName: string, existingTags: Array<{tagId: string, tagName: string, description: string | null}>, clerkUserId: string | null = null) {
    const systemPrompt = `You are an AI assistant that helps select and create relevant tags for IT articles. Your goal is to choose appropriate existing tags and suggest new ones when necessary.

IMPORTANT GUIDELINES:
1. Always prefer existing tags when they are relevant
2. Keep tag names SHORT and focused (1-3 words max)
3. Tags should be specific technical concepts, tools, or methodologies
4. Avoid generic words like "guide", "tutorial", "basics", "advanced"
5. Use standard industry terminology
6. For new tags, suggest a relevant color (hex code) that helps with organization
7. Don't create tags that are too similar to existing ones`;

    const userPrompt = `Article Title: "${articleTitle}"
Category: "${categoryName}"

EXISTING TAGS in the system:
${existingTags.map(tag => `- ID: ${tag.tagId}, Name: "${tag.tagName}"${tag.description ? `, Description: ${tag.description}` : ''}`).join('\n')}

Based on the article title and category, suggest:
1. Which existing tags (by ID) are relevant for this article
2. Any new tags that should be created for this article

RULES:
- Select 3-6 tags total (existing + new)
- New tag names should be concise and technical
- Focus on tools, technologies, concepts, methodologies
- Avoid duplicating existing tag concepts
- For new tags, provide optional descriptions and colors`;

    const startTime = new Date();
    
    try {
      const { model, interactionType } = await getModelForInteraction('tag_selection');
      const aiModel = await createProviderForModel(model.modelId);
      
      const result = await generateObject({
        model: aiModel,
        system: systemPrompt,
        prompt: userPrompt,
        schema: TagSelectionResponseSchema,
        temperature: 0.3, // Lower temperature for more consistent tagging
        maxTokens: 1000,
      });
      
      const endTime = new Date();
      
      await trackAIInteraction(
        model.modelId,
        interactionType.typeId,
        clerkUserId,
        result.usage?.promptTokens || 0,
        result.usage?.completionTokens || 0,
        startTime,
        endTime,
        { articleTitle, categoryName, existingTagsCount: existingTags.length },
        userPrompt,
        JSON.stringify(result.object)
      );
      
      return result.object;
    } catch (err) {
      const endTime = new Date();
      try {
        const { model, interactionType } = await getModelForInteraction('tag_selection');
        await trackAIInteraction(model.modelId, interactionType.typeId, clerkUserId, 0, 0, startTime, endTime, { articleTitle, categoryName }, userPrompt, undefined, String(err));
      } catch (trackingError) {
        console.error('Failed to track error:', trackingError);
      }
      throw err;
    }
  },

  // Get all active AI models
  async getActiveModels() {
    return await prisma.aIModel.findMany({
      where: { isActive: true },
      orderBy: { displayName: 'asc' }
    });
  },

  // Get all interaction types
  async getInteractionTypes() {
    return await prisma.aIInteractionType.findMany({
      include: { defaultModel: true },
      orderBy: { displayName: 'asc' }
    });
  },

  // Utility functions for admin management
  async createModel(data: {
    modelName: string;
    provider: string;
    displayName: string;
    description?: string;
    apiKey: string;
    inputTokenCostPer1M: number;
    outputTokenCostPer1M: number;
    maxTokens?: number;
    isDefault?: boolean;
  }) {
    return await prisma.aIModel.create({
      data: {
        ...data,
        apiKey: encryptApiKey(data.apiKey),
        inputTokenCostPer1M: data.inputTokenCostPer1M,
        outputTokenCostPer1M: data.outputTokenCostPer1M,
      }
    });
  },

  async updateModel(modelId: string, data: any) {
    if (data.apiKey) {
      data.apiKey = encryptApiKey(data.apiKey);
    }
    return await prisma.aIModel.update({
      where: { modelId },
      data
    });
  },

  async deleteModel(modelId: string) {
    return await prisma.aIModel.delete({
      where: { modelId }
    });
  }
};

// Export utility functions
export { createProviderForModel, getModelForInteraction, trackAIInteraction };

// Export types
export type CategorySuggestion = z.infer<typeof CategorySuggestionSchema>;
export type ArticleSuggestion = z.infer<typeof ArticleSuggestionSchema>;
export type AISearchResponse = z.infer<typeof AISearchResponseSchema>;
export type InteractiveExampleGeneration = z.infer<typeof InteractiveExampleSchema>;
export type ExampleGenerationResponse = z.infer<typeof ExampleGenerationResponseSchema>;
export type MarkingResponse = z.infer<typeof MarkingResponseSchema>;
export type ReorderResultsResponse = z.infer<typeof ReorderResultsSchema>;
export type KeywordExtractionResponse = z.infer<typeof KeywordExtractionSchema>;
export type TagSuggestion = z.infer<typeof TagSuggestionSchema>;
export type TagSelectionResponse = z.infer<typeof TagSelectionResponseSchema>;
export type ArticleSuggestionValidationResponse = z.infer<typeof ArticleSuggestionValidationSchema>;