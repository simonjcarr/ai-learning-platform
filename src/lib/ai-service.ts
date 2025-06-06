import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject, generateText, streamText } from 'ai';
import { z } from 'zod';
import { prisma } from './prisma';
import crypto from 'crypto';
import { createPatch } from 'diff';
import { rateLimitManager, RateLimitError } from './rate-limit';

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

// Get model and configuration for specific interaction type
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

// Check for rate limits before making AI calls
async function checkRateLimitBeforeCall(provider: string, modelId: string): Promise<void> {
  const rateLimitInfo = await rateLimitManager.checkRateLimit(provider, modelId);
  
  if (rateLimitInfo.isRateLimited) {
    const secondsRemaining = rateLimitInfo.secondsRemaining || 60;
    console.log(`🚫 Rate limit active for ${provider}:${modelId}. ${secondsRemaining}s remaining.`);
    
    throw new RateLimitError(
      `Rate limit active for ${provider}:${modelId}. Try again in ${secondsRemaining} seconds.`,
      provider,
      modelId,
      secondsRemaining
    );
  }
}

// Handle AI API errors and check for rate limits
async function handleAIError(error: any, provider: string, modelId: string): Promise<never> {
  // Check if this is a rate limit error
  if (rateLimitManager.isRateLimitError(error, provider)) {
    const rateLimitError = await rateLimitManager.handleRateLimitError(error, provider, modelId);
    throw rateLimitError;
  }
  
  // For non-rate-limit errors, throw the original error
  throw error;
}

// Get AI configuration for interaction type (with fallbacks for legacy hardcoded values)
async function getAIConfigForInteraction(interactionTypeName: string) {
  const { model, interactionType } = await getModelForInteraction(interactionTypeName);
  
  // Determine temperature (database > defaults based on interaction type)
  let temperature = interactionType.temperature;
  if (temperature === null || temperature === undefined) {
    // Fallback to hardcoded defaults based on interaction type
    switch (interactionTypeName) {
      case 'answer_marking':
      case 'keyword_extraction':
      case 'search_reordering':
        temperature = 0.3;
        break;
      case 'interactive_examples':
        temperature = 0.8;
        break;
      default:
        temperature = 0.7;
    }
  }
  
  // Determine max tokens (database > defaults based on interaction type)
  let maxTokens = interactionType.maxTokens;
  if (maxTokens === null || maxTokens === undefined) {
    // Fallback to hardcoded defaults based on interaction type
    switch (interactionTypeName) {
      case 'search_suggestions':
        maxTokens = 1000;
        break;
      case 'article_generation':
        maxTokens = 16000;
        break;
      case 'interactive_examples':
        maxTokens = 2000;
        break;
      case 'answer_marking':
        maxTokens = 500;
        break;
      case 'keyword_extraction':
        maxTokens = 500;
        break;
      case 'search_reordering':
        maxTokens = 1000;
        break;
      case 'tag_selection':
        maxTokens = 1000;
        break;
      case 'chat':
        maxTokens = 500;
        break;
      case 'article_suggestion_validation':
        maxTokens = 8000;
        break;
      default:
        maxTokens = 4000;
    }
  }
  
  // System prompt (database takes precedence, fallback to hardcoded if not set)
  let systemPrompt = interactionType.systemPrompt;
  
  return {
    model,
    interactionType,
    temperature,
    maxTokens,
    systemPrompt
  };
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
  contextData?: Record<string, unknown>,
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

export const SeoDataSchema = z.object({
  seoTitle: z.string(),
  seoDescription: z.string(),
  seoKeywords: z.array(z.string()),
  seoCanonicalUrl: z.string().optional(),
  seoImageAlt: z.string().optional(),
  seoChangeFreq: z.enum(['ALWAYS', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'NEVER']).default('WEEKLY'),
  seoPriority: z.number().min(0).max(1).default(0.7),
  seoNoIndex: z.boolean().default(false),
  seoNoFollow: z.boolean().default(false),
});

export const ArticleWithSeoSchema = z.object({
  title: z.string(),
  content: z.string(),
  seo: SeoDataSchema,
});

export const VideoRecommendationSchema = z.object({
  searchQuery: z.string(),
  context: z.string(),
  placement: z.enum(['introduction', 'middle', 'conclusion', 'supplement']),
  reasoning: z.string(),
});

export const VideoRecommendationsSchema = z.object({
  shouldIncludeVideos: z.boolean(),
  recommendations: z.array(VideoRecommendationSchema),
  explanation: z.string(),
});

// Enhanced AI Service functions with database tracking
export const aiService = {
  async generateSearchSuggestions(query: string, allCategories: { categoryName: string; description: string | null }[], existingArticles: { title: string; category: string }[], articlesToGenerate: number = 5, clerkUserId: string | null = null) {
    const hardcodedSystemPrompt = `You are an AI assistant helping users find and discover IT-related content. Based on their search query, suggest relevant categories and article titles that would be helpful. 

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
      const { model, interactionType, temperature, maxTokens, systemPrompt } = await getAIConfigForInteraction('search_suggestions');
      
      // Check for rate limits before making the call
      await checkRateLimitBeforeCall(model.provider, model.modelId);
      
      const aiModel = await createProviderForModel(model.modelId);
      
      result = await generateObject({
        model: aiModel,
        system: systemPrompt || hardcodedSystemPrompt,
        prompt: userPrompt,
        schema: AISearchResponseSchema,
        temperature,
        maxTokens,
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
      
      // Try to get model info for error tracking and rate limit handling
      try {
        const { model, interactionType } = await getModelForInteraction('search_suggestions');
        
        // Handle rate limit errors
        if (!(err instanceof RateLimitError)) {
          await handleAIError(err, model.provider, model.modelId);
        }
        
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
    const hardcodedSystemPrompt = `You are an expert IT technical writer and SEO specialist. Create comprehensive, detailed articles with SEO optimization.

You must return both the article content and complete SEO data following these guidelines:

CONTENT REQUIREMENTS:
- Comprehensive IT article in Markdown format
- Proper headings, code examples, and clear explanations
- Include practical examples and real-world scenarios
- Start directly with the title using # heading
- Use proper Markdown formatting throughout
- Include command-line examples where relevant
- Aim for 1200-1800 words of high-quality content (concise but thorough)

SEO REQUIREMENTS:
- SEO Title: 50-60 characters, include primary keyword
- SEO Description: 150-160 characters, compelling and descriptive
- SEO Keywords: 5-10 relevant technical keywords
- Change Frequency: Based on content type (tutorials=WEEKLY, reference=MONTHLY)
- Priority: 0.6-0.8 for most articles, 0.9 for fundamental topics
- Image Alt: If suggesting images, provide descriptive alt text`;
    
    let userPrompt = `Write a comprehensive IT article about "${title}" in the category "${categoryName}".

CONTENT STRUCTURE:
1. Start directly with the title using # (h1 heading)
2. Use proper Markdown formatting with # for h1, ## for h2, etc.
3. Include code examples with proper syntax highlighting (use triple backticks with language specification for code blocks ONLY)
4. Add practical examples and real-world use cases
5. Structure with clear sections: Introduction, Key Concepts, Examples, Best Practices, Common Issues, Conclusion
6. Make it educational and practical for IT professionals
7. Include command-line examples where relevant
8. Keep content focused and concise - aim for 1200-1800 words total

SEO OPTIMIZATION:
- Create an SEO-optimized title (50-60 characters)
- Write a compelling meta description (150-160 characters)
- Identify 5-10 relevant technical keywords
- Set appropriate change frequency and priority for sitemap
- Consider search intent and user needs

IMPORTANT: Return ONLY valid JSON with "title", "content", and "seo" fields. Ensure the content is complete but concise.`;

    const startTime = new Date();
    let result, error;
    let attempts = 0;
    const maxAttempts = 2;
    let model, interactionType;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        const config = await getAIConfigForInteraction('article_generation');
        model = config.model;
        interactionType = config.interactionType;
        const { temperature, maxTokens, systemPrompt } = config;
        const aiModel = await createProviderForModel(model.modelId);
        
        result = await generateObject({
          model: aiModel,
          system: systemPrompt || hardcodedSystemPrompt,
          prompt: userPrompt,
          schema: ArticleWithSeoSchema,
          temperature,
          maxTokens,
        });
        
        // If we get here, generation was successful
        break;
        
      } catch (genError) {
        console.error(`Article generation attempt ${attempts} failed:`, genError);
        
        if (attempts >= maxAttempts) {
          error = genError;
          break;
        }
        
        // If it's a JSON parsing error, try with stricter prompting
        if (genError instanceof Error && genError.message.includes('JSON parsing failed')) {
          userPrompt = userPrompt + '\n\nIMPORTANT: Ensure the response is valid JSON. If content is too long, make it more concise.';
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (error) {
      throw error;
    }

    const endTime = new Date();
    
    // Clean up any accidental code block wrappers in content
    let content = result.object.content.trim();
    if (content.startsWith('```markdown\n') && content.endsWith('\n```')) {
      content = content.slice(12, -4).trim();
    } else if (content.startsWith('```\n') && content.endsWith('\n```')) {
      content = content.slice(4, -4).trim();
    }
    
    // Use model info from the successful generation attempt
    
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
      JSON.stringify(result.object)
    );

    return {
      title: result.object.title,
      content,
      seo: {
        ...result.object.seo,
        seoLastModified: new Date(),
      },
      metaDescription: result.object.seo.seoDescription // Keep for backward compatibility
    };
  },

  async generateArticleContentWithStreaming(
    title: string, 
    categoryName: string, 
    clerkUserId: string | null = null,
    onProgress?: (message: string, percentage: number) => void,
    onContentChunk?: (chunk: string, fullContent: string) => void
  ) {
    const hardcodedSystemPrompt = `You are an expert IT technical writer. Create comprehensive, detailed articles in Markdown format.

CONTENT REQUIREMENTS:
- Write a comprehensive IT article in Markdown format
- Start directly with the title using # heading
- Use proper Markdown formatting throughout (##, ###, etc.)
- Include practical examples and real-world scenarios
- Include command-line examples where relevant
- Aim for 1200-1800 words of high-quality content
- Structure with clear sections: Introduction, Key Concepts, Examples, Best Practices, Common Issues, Conclusion
- Make it educational and practical for IT professionals

Write ONLY the markdown content - no JSON, no metadata, just pure markdown article content.`;
    
    let userPrompt = `Write a comprehensive IT article about "${title}" in the category "${categoryName}".

Start directly with the title using # (h1 heading) and then write the full article content using proper Markdown formatting.

Include:
- Clear introduction explaining the topic
- Key concepts and definitions
- Practical examples with code blocks where appropriate
- Best practices and recommendations
- Common issues and troubleshooting
- Conclusion summarizing key points

Write the article content directly in Markdown format - no JSON wrapper, no additional formatting.`;

    const startTime = new Date();
    let result, error;
    let attempts = 0;
    const maxAttempts = 2;
    let model, interactionType;
    
    onProgress?.('Initializing AI generation...', 15);
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        onProgress?.('Configuring AI model...', 20);
        
        const config = await getAIConfigForInteraction('article_generation');
        model = config.model;
        interactionType = config.interactionType;
        const { temperature, maxTokens, systemPrompt } = config;
        const aiModel = await createProviderForModel(model.modelId);
        
        onProgress?.('Generating content...', 25);
        
        // Use streaming approach and send content chunks
        const stream = await streamText({
          model: aiModel,
          system: systemPrompt || hardcodedSystemPrompt,
          prompt: userPrompt,
          temperature,
          maxTokens,
        });

        let fullContent = '';
        let lastProgress = 25;
        
        onProgress?.('Starting content generation...', lastProgress);
        
        // Stream the content and send chunks to callback
        for await (const chunk of stream.textStream) {
          fullContent += chunk;
          lastProgress = Math.min(90, Math.round(lastProgress + Math.random() * 2)); // Gradually increase progress, rounded to integer
          
          // Send the chunk and full content to the callback
          onContentChunk?.(chunk, fullContent);
          onProgress?.('Generating content...', lastProgress);
        }
        
        onProgress?.('Finalizing content...', 95);
        
        // Clean up any accidental code block wrappers in content
        let cleanContent = fullContent.trim();
        if (cleanContent.startsWith('```markdown\n') && cleanContent.endsWith('\n```')) {
          cleanContent = cleanContent.slice(12, -4).trim();
        } else if (cleanContent.startsWith('```\n') && cleanContent.endsWith('\n```')) {
          cleanContent = cleanContent.slice(4, -4).trim();
        }
        
        // Create a simple result structure for the streaming version
        result = {
          object: {
            title: title, // Use the provided title
            content: cleanContent,
            seo: {
              seoTitle: title.substring(0, 60),
              seoDescription: `Learn about ${title} in our comprehensive guide covering key concepts, examples, and best practices.`,
              seoKeywords: [categoryName.toLowerCase(), title.toLowerCase().split(' ').slice(0, 3)].flat(),
              seoChangeFreq: 'WEEKLY',
              seoPriority: 0.7,
              seoNoIndex: false,
              seoNoFollow: false
            }
          },
          usage: await stream.usage
        };
        
        // If we get here, generation was successful
        break;
        
      } catch (genError) {
        console.error(`Article generation attempt ${attempts} failed:`, genError);
        
        if (attempts >= maxAttempts) {
          error = genError;
          break;
        }
        
        // For any error, we can try again with a simplified prompt
        if (genError instanceof Error) {
          userPrompt = userPrompt + '\n\nIMPORTANT: Keep the content focused and well-structured. Write clear, concise markdown.';
        }
        
        onProgress?.(`Retrying generation (attempt ${attempts + 1})...`, 20);
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (error) {
      throw error;
    }

    const endTime = new Date();
    
    // Clean up any accidental code block wrappers in content
    let content = result.object.content.trim();
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
      JSON.stringify(result.object)
    );

    return {
      title: result.object.title,
      content,
      seo: {
        ...result.object.seo,
        seoLastModified: new Date(),
      },
      metaDescription: result.object.seo.seoDescription // Keep for backward compatibility
    };
  },

  async generateInteractiveExamples(articleTitle: string, categoryName: string, existingQuestions: string[], clerkUserId: string | null = null) {
    const hardcodedSystemPrompt = `You are an IT education expert creating interactive examples. Generate diverse, practical questions that test real understanding. Focus on real-world scenarios that IT professionals would encounter.`;
    
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
      const { model, interactionType, temperature, maxTokens, systemPrompt } = await getAIConfigForInteraction('interactive_examples');
      const aiModel = await createProviderForModel(model.modelId);
      
      result = await generateObject({
        model: aiModel,
        system: systemPrompt || hardcodedSystemPrompt,
        prompt: userPrompt,
        schema: ExampleGenerationResponseSchema,
        temperature,
        maxTokens,
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
    const hardcodedSystemPrompt = `You are an IT education expert marking student answers. Be encouraging but accurate. Provide constructive feedback that helps learning.`;
    
    const userPrompt = `Question: ${questionText}
Question Type: ${questionType}
User's Answer: ${userAnswer}
${markingHint ? `Marking Hint: ${markingHint}` : ''}

Evaluate if the answer is correct and provide helpful feedback. For command line questions, accept reasonable variations (e.g., with or without sudo, different flag orders).`;

    const startTime = new Date();
    let result, error;
    
    try {
      const { model, interactionType, temperature, maxTokens, systemPrompt } = await getAIConfigForInteraction('answer_marking');
      const aiModel = await createProviderForModel(model.modelId);
      
      result = await generateObject({
        model: aiModel,
        system: systemPrompt || hardcodedSystemPrompt,
        prompt: userPrompt,
        schema: MarkingResponseSchema,
        temperature,
        maxTokens,
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
    const hardcodedSystemPrompt = `You are an AI assistant that analyzes user search queries to extract relevant keywords and understand search intent. Your goal is to help find the most relevant content by identifying key terms and concepts.`;

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
      const { model, interactionType, temperature, maxTokens, systemPrompt } = await getAIConfigForInteraction('keyword_extraction');
      const aiModel = await createProviderForModel(model.modelId);
      
      const result = await generateObject({
        model: aiModel,
        system: systemPrompt || hardcodedSystemPrompt,
        prompt: userPrompt,
        schema: KeywordExtractionSchema,
        temperature,
        maxTokens,
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
    const hardcodedSystemPrompt = `You are an AI assistant that helps reorder search results based on relevance to the user's query. Your goal is to put the most relevant and helpful content first.

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
      const { model, interactionType, temperature, maxTokens, systemPrompt } = await getAIConfigForInteraction('search_reordering');
      const aiModel = await createProviderForModel(model.modelId);
      
      const result = await generateObject({
        model: aiModel,
        system: systemPrompt || hardcodedSystemPrompt,
        prompt: userPrompt,
        schema: ReorderResultsSchema,
        temperature,
        maxTokens,
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
    // Check for actual URLs in the suggestion details first to prevent spam
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
    
    // Check for explicit references to visiting external websites
    // Only match when explicitly asking to visit/check external sites
    const explicitWebsiteReferencePattern = /\b(check out|visit|go to|see|refer to|found at|available at|hosted at|located at)\s+(the\s+)?(website|site|webpage|web page|blog|portal|platform|documentation|docs|repo|repository)\b/gi;
    const promotionalPattern = /\b(my|our|their)\s+(website|site|blog|channel|platform|service|product)\b/gi;
    
    if (explicitWebsiteReferencePattern.test(suggestionDetails) || promotionalPattern.test(suggestionDetails)) {
      return {
        isValid: false,
        reason: 'Suggestions that reference external websites or resources are not allowed. Please describe the improvement using only the content that should be added to the article itself.',
        updatedContent: null,
        diff: null,
        description: null
      };
    }
    
    const hardcodedSystemPrompt = `You are an AI assistant helping to validate and apply user suggestions to educational IT articles. Be concise but thorough.`;
    
    // For very large articles, we might need to be more strategic
    const contentLength = articleContent.length;
    const isLargeArticle = contentLength > 10000;
    
    const processedContent = articleContent;
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
   - Contains ANY URLs, links, or web addresses (http://, https://, www.)
   - Explicitly asks users to visit external websites or resources
   - Contains promotional language about external services
   - Contains phrases like "visit [website]", "check out [site]", "go to [url]"
   - Attempts to promote specific external platforms or services
   
   NOTE: Technology names (Docker, GitHub, Kubernetes, etc.) used in technical context are ALLOWED when not promoting external visits
   
3. If the suggestion is VALID and contains NO external references:
   - Apply the suggested change to the article
   - Return the COMPLETE updated article in Markdown format
   - Ensure all Markdown formatting is preserved (headings, code blocks, lists, etc.)
   - The updated content should include the entire article, not just the changed section
   - Also provide a human-readable description of the change made
   
4. If the suggestion is INVALID:
   - Explain clearly why the suggestion cannot be applied
   - If it contains URLs or promotes external sites, state: "Suggestions containing URLs or promoting external websites are not allowed. Please provide self-contained improvements."

IMPORTANT: 
- The updatedContent field must contain the ENTIRE article in valid Markdown format
- Preserve all existing Markdown formatting (# headings, code blocks with triple backticks, lists, etc.)
- Do not wrap the content in any additional code blocks
- The description should be a concise summary of what was changed
- NEVER add ANY external links, references, or website mentions to the article`;

    const startTime = new Date();
    let result, error;
    
    try {
      const { model, interactionType, temperature, maxTokens, systemPrompt } = await getAIConfigForInteraction('article_suggestion_validation');
      const aiModel = await createProviderForModel(model.modelId);
      
      // Calculate needed tokens based on article size, but use database value if it's sufficient
      const estimatedOutputTokens = Math.ceil(contentLength / 3) + 1000; // Extra for the added content
      const maxTokensNeeded = Math.min(estimatedOutputTokens, 16000); // Cap at 16k tokens
      const finalMaxTokens = Math.max(maxTokensNeeded, maxTokens || 4000);
      
      result = await generateObject({
        model: aiModel,
        system: systemPrompt || hardcodedSystemPrompt,
        prompt: userPrompt,
        schema: ArticleSuggestionValidationSchema,
        temperature,
        maxTokens: finalMaxTokens,
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
    const hardcodedSystemPrompt = `You are an AI assistant that helps select and create relevant tags for IT articles. Your goal is to choose appropriate existing tags and suggest new ones when necessary.

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
      const { model, interactionType, temperature, maxTokens, systemPrompt } = await getAIConfigForInteraction('tag_selection');
      const aiModel = await createProviderForModel(model.modelId);
      
      const result = await generateObject({
        model: aiModel,
        system: systemPrompt || hardcodedSystemPrompt,
        prompt: userPrompt,
        schema: TagSelectionResponseSchema,
        temperature,
        maxTokens,
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

  async updateModel(modelId: string, data: Record<string, unknown>) {
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
  },

  async validateCourseArticleSuggestion(articleTitle: string, articleContent: string, suggestionType: string, suggestionDetails: string, clerkUserId: string | null = null) {
    // This is a special version for course articles that allows external links and YouTube videos
    const hardcodedSystemPrompt = `You are an AI assistant helping to validate and apply admin suggestions to educational IT course articles. Be concise but thorough.
    
IMPORTANT: This is for course content where external links and resources ARE ALLOWED and encouraged.`;
    
    // For very large articles, we might need to be more strategic
    const contentLength = articleContent.length;
    const isLargeArticle = contentLength > 10000;
    
    const processedContent = articleContent;
    if (isLargeArticle && contentLength > 20000) {
      // For extremely large articles, we might need to truncate
      console.log(`Course article is very large (${contentLength} chars), processing full content`);
    }
    
    const userPrompt = `Article Title: ${articleTitle}
Current Content (in Markdown format):
${processedContent}

User Suggestion Type: ${suggestionType}
User Suggestion Details: ${suggestionDetails}

Please analyze this admin suggestion for a course article:

1. First, determine if the suggestion is appropriate and valid:
   - Is it relevant to the article's topic and title?
   - Is it technically accurate?
   - Is it appropriate for the article's educational purpose?
   - Does it improve the article's quality or clarity?
   
2. SPECIAL RULES FOR COURSE ARTICLES:
   - External links ARE ALLOWED and encouraged
   - YouTube video links ARE ALLOWED
   - References to external resources ARE ALLOWED
   - Educational resources from any website ARE ALLOWED
   - GitHub repositories, documentation sites, etc. ARE ALLOWED
   
3. If the suggestion is VALID:
   - Apply the suggested change to the article
   - Return the COMPLETE updated article in Markdown format
   - Ensure all Markdown formatting is preserved (headings, code blocks, lists, etc.)
   - Format any links properly in Markdown: [link text](URL)
   - Format YouTube embeds as: ![Video Title](youtube-video-id) or as a regular link
   - The updated content should include the entire article, not just the changed section
   - Also provide a human-readable description of the change made
   
4. If the suggestion is INVALID:
   - Explain clearly why the suggestion cannot be applied
   - Focus on technical accuracy and relevance, not on external link restrictions

IMPORTANT: 
- The updatedContent field must contain the ENTIRE article in valid Markdown format
- Preserve all existing Markdown formatting (# headings, code blocks with triple backticks, lists, etc.)
- Do not wrap the content in any additional code blocks
- The description should be a concise summary of what was changed
- External links and resources ARE WELCOME in course articles`;

    const startTime = new Date();
    let result, error;
    
    try {
      const { model, interactionType, temperature, maxTokens, systemPrompt } = await getAIConfigForInteraction('article_suggestion_validation');
      const aiModel = await createProviderForModel(model.modelId);
      
      // Calculate needed tokens based on article size, but use database value if it's sufficient
      const estimatedOutputTokens = Math.ceil(contentLength / 3) + 1000; // Extra for the added content
      const maxTokensNeeded = Math.min(estimatedOutputTokens, 16000); // Cap at 16k tokens
      const finalMaxTokens = Math.max(maxTokensNeeded, maxTokens || 4000);
      
      result = await generateObject({
        model: aiModel,
        system: systemPrompt || hardcodedSystemPrompt,
        prompt: userPrompt,
        schema: ArticleSuggestionValidationSchema,
        temperature,
        maxTokens: finalMaxTokens,
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
        { articleTitle, suggestionType, isCourseArticle: true },
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
          { articleTitle, suggestionType, isCourseArticle: true },
          userPrompt,
          undefined,
          String(err)
        );
      } catch (trackingError) {
        console.error('Failed to track error:', trackingError);
      }
      
      console.error("Course article suggestion validation error:", err);
      throw err;
    }
  }
};

// Generic callAI function for workers and other use cases
export async function callAI(
  interactionTypeName: string,
  prompt: string,
  contextData?: Record<string, unknown>,
  clerkUserId: string | null = null
): Promise<string> {
  const startTime = new Date();
  let result, error;
  
  try {
    const { model, interactionType, temperature, maxTokens, systemPrompt } = await getAIConfigForInteraction(interactionTypeName);
    
    // Check for rate limits before making the call
    await checkRateLimitBeforeCall(model.provider, model.modelId);
    
    const aiModel = await createProviderForModel(model.modelId);
    
    result = await generateText({
      model: aiModel,
      system: systemPrompt || undefined,
      prompt,
      temperature,
      maxTokens,
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
      contextData,
      prompt,
      result.text
    );
    
    return result.text;
  } catch (err) {
    error = err;
    const endTime = new Date();
    
    // Try to get model info for error tracking and rate limit handling
    try {
      const { model, interactionType } = await getModelForInteraction(interactionTypeName);
      
      // Handle rate limit errors
      if (!(err instanceof RateLimitError)) {
        await handleAIError(err, model.provider, model.modelId);
      }
      
      await trackAIInteraction(
        model.modelId,
        interactionType.typeId,
        clerkUserId,
        0,
        0,
        startTime,
        endTime,
        contextData,
        prompt,
        undefined,
        String(err)
      );
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError);
    }
    
    throw error;
  }
}

// Add generateVideoRecommendations to aiService
aiService.generateVideoRecommendations = async function(
  articleTitle: string,
  articleContent: string,
  courseContext?: {
    courseTitle: string;
    courseDescription: string;
    courseLevel: string;
    sectionTitle?: string;
    sectionDescription?: string;
  },
  clerkUserId: string | null = null
) {
  const hardcodedSystemPrompt = `You are an educational content specialist who helps identify when YouTube videos would enhance learning and suggests appropriate search terms.

Your task is to analyze course article content and determine if educational YouTube videos would improve the learning experience. When videos would be helpful, provide specific search queries to find relevant educational content.

GUIDELINES:
- Only recommend videos when they would genuinely improve understanding
- Focus on educational, tutorial, and instructional content
- Prefer videos that demonstrate concepts, show practical examples, or provide visual explanations
- Consider the target audience and course level
- Provide specific search terms that will find high-quality educational videos
- Explain WHY each video would be helpful and WHERE it should be placed

SEARCH QUERY REQUIREMENTS:
- Be specific enough to find relevant educational content
- Include terms like "tutorial", "explanation", "guide", "demo" when appropriate
- Consider the course level (beginner, intermediate, advanced)
- Focus on finding authoritative educational channels and content

PLACEMENT OPTIONS:
- introduction: Video that introduces or overviews the topic
- middle: Video that demonstrates specific concepts or procedures
- conclusion: Video that reinforces learning or shows advanced applications
- supplement: Additional resource for deeper learning`;

  const userPrompt = `Analyze this course article and determine if YouTube videos would enhance the learning experience:

COURSE CONTEXT:
${courseContext ? `
- Course: ${courseContext.courseTitle}
- Description: ${courseContext.courseDescription}
- Level: ${courseContext.courseLevel}
${courseContext.sectionTitle ? `- Section: ${courseContext.sectionTitle}` : ''}
${courseContext.sectionDescription ? `- Section Description: ${courseContext.sectionDescription}` : ''}
` : ''}

ARTICLE TITLE: ${articleTitle}

ARTICLE CONTENT:
${articleContent}

ANALYSIS REQUIREMENTS:
1. Determine if videos would genuinely improve learning for this content
2. If yes, suggest 1-3 specific search queries for finding relevant educational videos
3. For each suggestion, specify WHERE in the article it should be placed and WHY
4. Provide clear reasoning for your recommendations

Focus on finding videos that:
- Demonstrate practical examples
- Show visual representations of concepts
- Provide step-by-step tutorials
- Offer alternative explanations
- Show real-world applications

Return your analysis as structured data.`;

  const startTime = new Date();
  let result, error;
  
  try {
    // Use a generic interaction type or create a new one for video recommendations
    const { model, interactionType, temperature, maxTokens, systemPrompt } = await getAIConfigForInteraction('article_generation');
    const aiModel = await createProviderForModel(model.modelId);
    
    // Check rate limits
    await checkRateLimitBeforeCall(model.provider, model.modelId);
    
    result = await generateObject({
      model: aiModel,
      system: systemPrompt || hardcodedSystemPrompt,
      prompt: userPrompt,
      schema: VideoRecommendationsSchema,
      temperature: temperature || 0.7,
      maxTokens: Math.min(maxTokens || 2000, 2000), // Limit tokens for this specific task
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
      { 
        articleTitle, 
        courseTitle: courseContext?.courseTitle,
        hasRecommendations: result.object.shouldIncludeVideos,
        recommendationCount: result.object.recommendations.length 
      },
      userPrompt,
      JSON.stringify(result.object)
    );
    
    return result.object;
  } catch (err) {
    error = err;
    const endTime = new Date();
    
    // Try to get model info for error tracking and rate limit handling
    try {
      const { model, interactionType } = await getModelForInteraction('article_generation');
      
      // Handle rate limit errors
      if (!(err instanceof RateLimitError)) {
        await handleAIError(err, model.provider, model.modelId);
      }
      
      await trackAIInteraction(
        model.modelId,
        interactionType.typeId,
        clerkUserId,
        0,
        0,
        startTime,
        endTime,
        { articleTitle, courseTitle: courseContext?.courseTitle },
        userPrompt,
        undefined,
        String(err)
      );
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError);
    }
    
    throw error;
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
export type SeoData = z.infer<typeof SeoDataSchema>;
export type ArticleWithSeo = z.infer<typeof ArticleWithSeoSchema>;
export type VideoRecommendation = z.infer<typeof VideoRecommendationSchema>;
export type VideoRecommendationsResponse = z.infer<typeof VideoRecommendationsSchema>;