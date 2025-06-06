import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating AI assistant user...');

  const aiUser = await prisma.user.upsert({
    where: { clerkUserId: 'ai-assistant' },
    update: {},
    create: {
      clerkUserId: 'ai-assistant',
      email: 'ai-assistant@internal.system',
      firstName: 'AI',
      lastName: 'Assistant',
      imageUrl: null,
      role: 'USER',
      subscriptionTier: 'System',
    },
  });

  console.log('Created AI assistant user:', aiUser.firstName, aiUser.lastName);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });