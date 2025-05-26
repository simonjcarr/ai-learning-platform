import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

// Get AI configuration from environment variables
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4-0125-preview';

// Initialize providers
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Provider mapping
const providers = {
  openai,
  google,
  anthropic,
} as const;

// Model mapping for easy switching
const modelMap: Record<string, string> = {
  // OpenAI models
  'gpt-4-0125-preview': 'gpt-4-0125-preview',
  'gpt-4': 'gpt-4',
  'gpt-3.5-turbo': 'gpt-3.5-turbo',
  
  // Google models
  'gemini-2.5-flash': 'gemini-2.0-flash-exp',
  'gemini-pro': 'gemini-pro',
  
  // Anthropic models
  'claude-3-opus': 'claude-3-opus-20240229',
  'claude-3-sonnet': 'claude-3-sonnet-20240229',
  'claude-3-haiku': 'claude-3-haiku-20240307',
};

// Get the configured model
function getModel() {
  const provider = providers[AI_PROVIDER as keyof typeof providers];
  if (!provider) {
    throw new Error(`Invalid AI provider: ${AI_PROVIDER}`);
  }
  
  const modelName = modelMap[AI_MODEL] || AI_MODEL;
  return provider(modelName);
}

// Schema definitions for structured outputs
export const CategorySuggestionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export const ArticleSuggestionSchema = z.object({
  title: z.string(),
  target_category_name: z.string(),
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

// AI Service functions
export const aiService = {
  async generateSearchSuggestions(query: string, existingCategories: string[], existingArticles: { title: string; category: string }[]) {
    const systemPrompt = `You are an AI assistant helping users find and discover IT-related content. Based on their search query, suggest relevant categories and article titles that would be helpful. Ensure suggestions are practical and relevant to IT professionals.`;
    
    const userPrompt = `Search query: "${query}"
    
Existing categories: ${JSON.stringify(existingCategories)}
Existing articles: ${JSON.stringify(existingArticles)}

Suggest new categories and article titles that would be helpful for this search. Don't suggest existing items.`;

    const result = await generateObject({
      model: getModel(),
      system: systemPrompt,
      prompt: userPrompt,
      schema: AISearchResponseSchema,
      temperature: 0.7,
      maxTokens: 1000,
    });

    return result.object;
  },

  async generateArticleContent(title: string, categoryName: string) {
    const systemPrompt = `You are an expert IT technical writer. Create comprehensive, detailed articles in Markdown format with proper headings, code examples, and clear explanations. Include practical examples and real-world scenarios.`;
    
    const userPrompt = `Write a comprehensive IT article about "${title}" in the category "${categoryName}".

Requirements:
1. Use proper Markdown formatting with # for h1, ## for h2, etc.
2. Include code examples with proper syntax highlighting (use triple backticks with language specification)
3. Add practical examples and real-world use cases
4. Structure with clear sections: Introduction, Key Concepts, Examples, Best Practices, Common Issues, Conclusion
5. Make it educational and practical for IT professionals
6. Include command-line examples where relevant
7. Aim for 1500-2500 words of high-quality content`;

    const result = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      maxTokens: 4000,
    });

    return {
      title,
      content: result.text,
      metaDescription: `Learn about ${title} in ${categoryName}. Comprehensive guide with examples and best practices.`
    };
  },

  async generateInteractiveExamples(articleTitle: string, categoryName: string, existingQuestions: string[]) {
    const systemPrompt = `You are an IT education expert creating interactive examples. Generate diverse, practical questions that test real understanding. Focus on real-world scenarios that IT professionals would encounter.`;
    
    const userPrompt = `Based on the IT article titled "${articleTitle}" in the category "${categoryName}", generate 3-5 unique interactive examples to test understanding.

${existingQuestions.length > 0 ? `Avoid these existing questions: ${JSON.stringify(existingQuestions)}` : ''}

For each example:
- Choose question type intelligently from 'multiple_choice', 'text_input', or 'command_line'
- Create practical, real-world scenarios
- For multiple choice, provide 4-5 plausible options with format: {"id": "a", "text": "Option text"}
- Include clear explanations for correct answers
- Add keywords for AI marking (for text/command line questions)`;

    const result = await generateObject({
      model: getModel(),
      system: systemPrompt,
      prompt: userPrompt,
      schema: ExampleGenerationResponseSchema,
      temperature: 0.8,
      maxTokens: 2000,
    });

    return result.object;
  },

  async markUserAnswer(questionText: string, userAnswer: string, questionType: string, markingHint?: string) {
    const systemPrompt = `You are an IT education expert marking student answers. Be encouraging but accurate. Provide constructive feedback that helps learning.`;
    
    const userPrompt = `Question: ${questionText}
Question Type: ${questionType}
User's Answer: ${userAnswer}
${markingHint ? `Marking Hint: ${markingHint}` : ''}

Evaluate if the answer is correct and provide helpful feedback. For command line questions, accept reasonable variations (e.g., with or without sudo, different flag orders).`;

    const result = await generateObject({
      model: getModel(),
      system: systemPrompt,
      prompt: userPrompt,
      schema: MarkingResponseSchema,
      temperature: 0.3,
      maxTokens: 500,
    });

    return result.object;
  },

  // Utility function to get current provider and model info
  getProviderInfo() {
    return {
      provider: AI_PROVIDER,
      model: AI_MODEL,
      actualModel: modelMap[AI_MODEL] || AI_MODEL,
    };
  },
};

// Export types
export type CategorySuggestion = z.infer<typeof CategorySuggestionSchema>;
export type ArticleSuggestion = z.infer<typeof ArticleSuggestionSchema>;
export type AISearchResponse = z.infer<typeof AISearchResponseSchema>;
export type InteractiveExampleGeneration = z.infer<typeof InteractiveExampleSchema>;
export type ExampleGenerationResponse = z.infer<typeof ExampleGenerationResponseSchema>;
export type MarkingResponse = z.infer<typeof MarkingResponseSchema>;