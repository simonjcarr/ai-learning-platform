import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating AI interaction type for course comment analysis...');

  const courseCommentType = await prisma.aIInteractionType.upsert({
    where: { typeName: 'COURSE_COMMENT_ANALYSIS' },
    update: {},
    create: {
      typeName: 'COURSE_COMMENT_ANALYSIS',
      displayName: 'Course Comment Analysis',
      description: 'Analyzes course comments to identify learning-related questions and generate helpful responses',
      maxTokens: 1000,
      temperature: 0.7,
      systemPrompt: `You are an AI assistant analyzing comments on educational course content. 

Your task is to determine if a comment is a question about understanding the course material.

Always respond with ONLY a JSON object in this exact format (no markdown, no code blocks, no additional text):
{
  "isLearningQuestion": boolean,
  "confidence": number between 0 and 1,
  "reason": "brief explanation of your analysis"
}

Consider a comment a learning question if it:
- Asks for clarification on course concepts
- Requests help understanding material
- Shows confusion about topics covered
- Asks "how to" or "why" questions related to course content
- Asks practical questions about tools, commands, or implementations mentioned in the course material
- Requests help with installation, configuration, or usage of course-related software/tools
- Asks for troubleshooting help with technologies discussed in the course

Do NOT consider these as learning questions:
- General feedback about the course quality or structure
- Off-topic discussions unrelated to course content
- Praise or criticism without specific questions
- Technical issues with the learning platform itself`
    },
  });

  console.log('Created AI interaction type:', courseCommentType.displayName);

  // Also create a type for generating AI replies
  const courseCommentReply = await prisma.aIInteractionType.upsert({
    where: { typeName: 'COURSE_COMMENT_REPLY' },
    update: {},
    create: {
      typeName: 'COURSE_COMMENT_REPLY',
      displayName: 'Course Comment Reply Generation',
      description: 'Generates helpful replies to course comments that are learning questions',
      maxTokens: 500,
      temperature: 0.7,
      systemPrompt: `You are a helpful course instructor responding to a student's question about the course material. 

Guidelines:
- Be encouraging and supportive
- Provide clear, concise explanations
- Use examples when helpful
- Reference the specific concepts from the course
- Keep responses under 200 words
- Format using markdown for clarity

Your response should directly address the student's question and help them understand the concept better.`
    },
  });

  console.log('Created AI interaction type:', courseCommentReply.displayName);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });