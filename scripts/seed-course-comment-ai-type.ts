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
      systemPrompt: `You are an AI assistant analyzing comments on educational course content. Your task is to:

1. Determine if the comment is a question about understanding the course material
2. If it is a learning-related question, generate a helpful, educational response
3. If it's not a learning question (e.g., general feedback, off-topic, etc.), indicate no response is needed

For learning questions, provide:
- Clear, concise explanations
- References to the specific concepts being discussed
- Encouragement to continue learning
- Suggestions for further exploration if relevant

Keep responses friendly, supportive, and focused on helping the student understand the material better.`
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