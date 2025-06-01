import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AIInteractionConfig {
  typeName: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
}

// All the hardcoded AI rules and configurations extracted from the codebase
const AI_INTERACTION_CONFIGS: AIInteractionConfig[] = [
  {
    typeName: 'search_suggestions',
    displayName: 'Search & Discovery',
    description: 'AI-powered search suggestions and content discovery',
    systemPrompt: `You are an AI assistant helping users find and discover IT-related content. Based on their search query, suggest relevant categories and article titles that would be helpful. 

IMPORTANT: 
1. Articles can belong to MULTIPLE categories. Assign articles to ALL relevant categories, not just one.
2. When suggesting articles, you MUST prefer using existing categories whenever possible. Only suggest new categories if none of the existing categories are appropriate.
3. Keep category names GENERIC and SIMPLE (e.g., "Docker", "Kubernetes", "Python", "Programming", NOT "Docker Basics" or "Advanced Python")
4. Be precise about technology distinctions - Docker and Docker Swarm are different, Kubernetes and OpenShift are different, etc.
5. Consider fundamental categories like "Programming", "DevOps", "Security", "Networking", etc. for articles that fit these broader topics.`,
    maxTokens: 1000,
    temperature: 0.7
  },
  {
    typeName: 'article_generation',
    displayName: 'Content Creation',
    description: 'Generate comprehensive IT articles with SEO optimization',
    systemPrompt: `You are an expert IT technical writer and SEO specialist. Create comprehensive, detailed articles with SEO optimization.

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
- Image Alt: If suggesting images, provide descriptive alt text`,
    maxTokens: 16000,
    temperature: 0.7
  },
  {
    typeName: 'interactive_examples',
    displayName: 'Quiz Generation',
    description: 'Generate interactive examples and quiz questions',
    systemPrompt: `You are an expert IT education specialist creating interactive learning content. Generate engaging quiz questions and examples that test practical knowledge and understanding.

REQUIREMENTS:
- Create questions that test real-world application, not just memorization
- Include practical scenarios and command-line examples
- Provide clear, detailed explanations for correct answers
- Make questions challenging but fair
- Focus on skills that IT professionals actually need`,
    maxTokens: 2000,
    temperature: 0.8
  },
  {
    typeName: 'answer_marking',
    displayName: 'Answer Evaluation',
    description: 'Evaluate and provide feedback on quiz answers',
    systemPrompt: `You are an expert IT instructor evaluating student answers. Provide constructive, helpful feedback that guides learning.

GUIDELINES:
- Be encouraging while being accurate
- Explain why answers are correct or incorrect
- Provide hints for improvement without giving away the answer
- Focus on understanding, not just correctness
- Help students learn from their mistakes`,
    maxTokens: 500,
    temperature: 0.3
  },
  {
    typeName: 'keyword_extraction',
    displayName: 'Search Optimization',
    description: 'Extract keywords and optimize search functionality',
    systemPrompt: `You are a search optimization specialist. Extract relevant keywords and understand search intent to improve content discovery.

FOCUS ON:
- Technical terms and concepts
- Practical applications
- Related technologies and tools
- Search intent (learning, troubleshooting, implementation)
- Alternative search terms users might use`,
    maxTokens: 500,
    temperature: 0.3
  },
  {
    typeName: 'search_reordering',
    displayName: 'Result Ranking',
    description: 'Intelligently reorder search results based on relevance',
    systemPrompt: `You are a content relevance specialist. Reorder search results to prioritize the most helpful and relevant content for the user's query.

PRIORITIZE:
- Direct answers to specific questions
- Comprehensive tutorials for broad topics
- Up-to-date content over outdated information
- Practical, actionable content
- Content that matches the user's skill level implied by their query`,
    maxTokens: 1000,
    temperature: 0.3
  },
  {
    typeName: 'tag_selection',
    displayName: 'Content Tagging',
    description: 'Automatically suggest and assign relevant tags to content',
    systemPrompt: `You are a content organization specialist. Suggest relevant tags that help categorize and discover IT content effectively.

GUIDELINES:
- Use specific, technical terms as tags
- Include both broad categories and specific technologies
- Consider difficulty levels and target audiences
- Focus on discoverable, searchable terms
- Balance specificity with broad appeal`,
    maxTokens: 1000,
    temperature: 0.7
  },
  {
    typeName: 'chat',
    displayName: 'Tutoring Interactions',
    description: 'Provide educational support and answer questions about articles',
    systemPrompt: `You are an AI tutor helping a student understand an IT/Linux learning article. 
Your role is to:
1. Answer questions about the article content clearly and concisely
2. Help explain quiz questions and guide students to understand the correct answers
3. Provide additional context and examples when helpful
4. Never directly give away quiz answers - instead guide the student to understand the concept
5. Be encouraging and supportive`,
    maxTokens: 500,
    temperature: 0.7
  },
  {
    typeName: 'article_suggestion_validation',
    displayName: 'Content Moderation',
    description: 'Validate and moderate user-submitted article suggestions',
    systemPrompt: `You are a content moderation specialist for an IT learning platform. Validate user suggestions for article improvements while filtering out spam and inappropriate content.

VALIDATION CRITERIA:
- Reject suggestions that contain external URLs or links to other websites
- Reject promotional content or advertisements
- Reject spam, low-quality, or irrelevant suggestions
- Accept legitimate improvements: corrections, clarifications, additional examples
- Accept technical updates and new information
- Accept formatting and readability improvements

ALWAYS EXPLAIN YOUR REASONING and provide constructive feedback to users.`,
    maxTokens: 8000,
    temperature: 0.7
  }
];

async function main() {
  console.log('🚀 Starting AI rules migration to database...');

  try {
    // First, let's see what interaction types already exist
    const existingTypes = await prisma.aIInteractionType.findMany({
      select: { typeName: true, systemPrompt: true }
    });
    
    console.log(`📋 Found ${existingTypes.length} existing interaction types`);
    
    for (const config of AI_INTERACTION_CONFIGS) {
      const existing = existingTypes.find(t => t.typeName === config.typeName);
      
      if (existing) {
        // Update existing interaction type if it doesn't have a system prompt
        if (!existing.systemPrompt) {
          console.log(`📝 Updating ${config.typeName} with AI rules...`);
          await prisma.aIInteractionType.update({
            where: { typeName: config.typeName },
            data: {
              displayName: config.displayName,
              description: config.description,
              systemPrompt: config.systemPrompt,
              maxTokens: config.maxTokens,
              temperature: config.temperature
            }
          });
          console.log(`✅ Updated ${config.typeName}`);
        } else {
          console.log(`⏭️  Skipping ${config.typeName} (already has system prompt)`);
        }
      } else {
        // Create new interaction type
        console.log(`🆕 Creating new interaction type: ${config.typeName}...`);
        await prisma.aIInteractionType.create({
          data: {
            typeName: config.typeName,
            displayName: config.displayName,
            description: config.description,
            systemPrompt: config.systemPrompt,
            maxTokens: config.maxTokens,
            temperature: config.temperature
          }
        });
        console.log(`✅ Created ${config.typeName}`);
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    const allTypes = await prisma.aIInteractionType.findMany({
      select: { 
        typeName: true, 
        displayName: true, 
        systemPrompt: true, 
        maxTokens: true, 
        temperature: true 
      }
    });

    for (const type of allTypes) {
      const hasRules = type.systemPrompt ? '✅' : '❌';
      const hasTokens = type.maxTokens ? '✅' : '❌';
      const hasTemp = type.temperature !== null ? '✅' : '❌';
      console.log(`${type.typeName}: Rules ${hasRules}, Tokens ${hasTokens}, Temp ${hasTemp}`);
    }

    console.log('\n🎉 AI rules migration completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('1. Review the AI Interactions admin page to verify all rules are loaded');
    console.log('2. Test AI interactions to ensure they work with database-stored rules');
    console.log('3. Remove any remaining hardcoded AI rules from the codebase');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  });