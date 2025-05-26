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
  async generateSearchSuggestions(query: string, allCategories: { categoryName: string; description: string | null }[], existingArticles: { title: string; category: string }[], articlesToGenerate: number = 5) {
    const systemPrompt = `You are an AI assistant helping users find and discover IT-related content. Based on their search query, suggest relevant categories and article titles that would be helpful. 

IMPORTANT: 
1. When suggesting articles, you MUST prefer using existing categories whenever possible. Only suggest new categories if none of the existing categories are appropriate.
2. Keep category names GENERIC and SIMPLE (e.g., "Docker", "Kubernetes", "Python", NOT "Docker Basics" or "Advanced Python")
3. Be precise about technology distinctions - Docker and Docker Swarm are different, Kubernetes and OpenShift are different, etc.`;
    
    const userPrompt = `Search query: "${query}"
    
ALL EXISTING CATEGORIES in the system (use these whenever possible):
${allCategories.map(cat => `- ${cat.categoryName}${cat.description ? `: ${cat.description}` : ''}`).join('\n')}

Existing articles related to this search: ${JSON.stringify(existingArticles)}

Please suggest exactly ${articlesToGenerate} new article titles that would be helpful for this search.

CRITICAL RULES:
1. For each article, ALWAYS check if it fits into an existing category first
2. Use the exact category name from the list above when assigning articles
3. Only suggest a new category if absolutely none of the existing categories are appropriate
4. NEW CATEGORY NAMES MUST BE:
   - Generic and simple (e.g., "Docker Swarm" not "Docker Swarm Basics")
   - Just the technology/tool name without qualifiers
   - Distinct from related technologies (Docker ≠ Docker Swarm, Kubernetes ≠ OpenShift)
5. If suggesting a new category, provide a clear description
6. Don't suggest article titles that already exist
7. Articles must be SPECIFICALLY about the searched technology:
   - If searching for "Docker", suggest Docker articles (NOT Docker Swarm)
   - If searching for "Docker Swarm", suggest Docker Swarm articles specifically
   - Be precise about technology boundaries

Your target_category_name for each article MUST match exactly one of the existing category names listed above, unless creating a new category.`;

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

    const result = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      maxTokens: 4000,
    });

    // Clean up any accidental code block wrappers
    let content = result.text.trim();
    if (content.startsWith('```markdown\n') && content.endsWith('\n```')) {
      content = content.slice(12, -4).trim();
    } else if (content.startsWith('```\n') && content.endsWith('\n```')) {
      content = content.slice(4, -4).trim();
    }

    return {
      title,
      content,
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