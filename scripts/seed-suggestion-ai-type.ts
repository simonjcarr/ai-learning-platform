import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding Article Suggestion AI interaction type...');

  const suggestionType = await prisma.aIInteractionType.upsert({
    where: { typeName: 'article_suggestion_validation' },
    update: {
      displayName: 'Article Suggestion Validation',
      description: 'Validates and applies user suggestions for article improvements',
    },
    create: {
      typeName: 'article_suggestion_validation',
      displayName: 'Article Suggestion Validation',
      description: 'Validates and applies user suggestions for article improvements',
    },
  });

  console.log('Created/Updated AI interaction type:', suggestionType);

  // Create initial suggestion settings
  const settings = await prisma.suggestionSettings.findFirst();
  if (!settings) {
    await prisma.suggestionSettings.create({
      data: {
        rateLimitMinutes: 60,
        maxSuggestionsPerUser: 10,
        badgeThresholds: {
          bronze: 5,
          silver: 10,
          gold: 25,
        },
      },
    });
    console.log('Created initial suggestion settings');
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });