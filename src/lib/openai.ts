import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CategorySuggestion {
  name: string;
  description?: string;
}

export interface ArticleSuggestion {
  title: string;
  target_category_name: string;
}

export interface AISearchResponse {
  suggested_new_categories: CategorySuggestion[];
  suggested_new_article_titles: ArticleSuggestion[];
}

export interface InteractiveExampleGeneration {
  question_type: 'multiple_choice' | 'text_input' | 'command_line';
  scenario_or_question_text: string;
  options_json?: Array<{ id: string; text: string }>;
  correct_answer_key_or_text: string;
  correct_answer_description: string;
  ai_marking_prompt_hint?: string;
}

export interface ExampleGenerationResponse {
  examples: InteractiveExampleGeneration[];
}

export interface MarkingResponse {
  is_correct: boolean;
  feedback: string;
}