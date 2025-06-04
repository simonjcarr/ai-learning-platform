import { PrismaClient, FeatureType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating separate daily usage limit features for article and course AI chat...');

  // Get the LIMITS category ID
  const limitsCategory = await prisma.featureCategory.findUnique({
    where: { categoryKey: 'LIMITS' }
  });

  if (!limitsCategory) {
    console.error('❌ LIMITS category not found');
    process.exit(1);
  }

  // Create daily article AI chat limit feature
  const articleChatLimitFeature = await prisma.feature.upsert({
    where: { featureKey: 'daily_article_ai_chat_limit' },
    update: {},
    create: {
      featureKey: 'daily_article_ai_chat_limit',
      featureName: 'Daily Article AI Chat Limit',
      description: 'Maximum number of AI chat messages per day for regular articles',
      categoryId: limitsCategory.categoryId,
      featureType: FeatureType.NUMERIC_LIMIT,
      defaultValue: { limit: 0 },
      isActive: true
    }
  });

  // Create daily course AI chat limit feature  
  const courseChatLimitFeature = await prisma.feature.upsert({
    where: { featureKey: 'daily_course_ai_chat_limit' },
    update: {},
    create: {
      featureKey: 'daily_course_ai_chat_limit',
      featureName: 'Daily Course AI Chat Limit',
      description: 'Maximum number of AI chat messages per day for course articles',
      categoryId: limitsCategory.categoryId,
      featureType: FeatureType.NUMERIC_LIMIT,
      defaultValue: { limit: 0 },
      isActive: true
    }
  });

  console.log('✅ Created separate chat limit features');

  // Get all pricing tiers
  const pricingTiers = await prisma.subscriptionPricing.findMany({
    orderBy: { displayOrder: 'asc' }
  });

  console.log('Updating pricing tier assignments...');

  for (const tier of pricingTiers) {
    // Get current daily_ai_chat_limit assignment for this tier
    const dailyAiChatFeature = await prisma.feature.findUnique({ 
      where: { featureKey: 'daily_ai_chat_limit' } 
    });
    
    if (!dailyAiChatFeature) {
      console.log(`⚠️ Skipping ${tier.name}: daily_ai_chat_limit feature not found`);
      continue;
    }
    
    const currentLimit = await prisma.pricingTierFeature.findUnique({
      where: {
        pricingTierId_featureId: {
          pricingTierId: tier.pricingId,
          featureId: dailyAiChatFeature.featureId
        }
      }
    });

    if (currentLimit) {
      // Assign the same limit values to both new features
      await prisma.pricingTierFeature.upsert({
        where: {
          pricingTierId_featureId: {
            pricingTierId: tier.pricingId,
            featureId: articleChatLimitFeature.featureId
          }
        },
        update: {
          isEnabled: currentLimit.isEnabled,
          limitValue: currentLimit.limitValue
        },
        create: {
          pricingTierId: tier.pricingId,
          featureId: articleChatLimitFeature.featureId,
          isEnabled: currentLimit.isEnabled,
          limitValue: currentLimit.limitValue
        }
      });

      await prisma.pricingTierFeature.upsert({
        where: {
          pricingTierId_featureId: {
            pricingTierId: tier.pricingId,
            featureId: courseChatLimitFeature.featureId
          }
        },
        update: {
          isEnabled: currentLimit.isEnabled,
          limitValue: currentLimit.limitValue
        },
        create: {
          pricingTierId: tier.pricingId,
          featureId: courseChatLimitFeature.featureId,
          isEnabled: currentLimit.isEnabled,
          limitValue: currentLimit.limitValue
        }
      });

      console.log(`✅ Updated ${tier.name}: article limit = ${currentLimit.limitValue === -1 ? 'unlimited' : currentLimit.limitValue}, course limit = ${currentLimit.limitValue === -1 ? 'unlimited' : currentLimit.limitValue}`);
    }
  }

  console.log('🎉 Successfully created separate daily usage limit features');
  console.log('');
  console.log('Next steps:');
  console.log('1. Update usage tracking logic in src/lib/feature-access.ts');
  console.log('2. Update API routes to use appropriate limit features');
  console.log('3. Optionally remove old daily_ai_chat_limit feature after testing');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });