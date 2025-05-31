import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding pricing tier features...");

  // Get all features and pricing tiers
  const features = await prisma.feature.findMany();
  const pricingTiers = await prisma.subscriptionPricing.findMany();

  if (features.length === 0) {
    console.log("No features found. Please run seed-features.ts first.");
    return;
  }

  if (pricingTiers.length === 0) {
    console.log("No pricing tiers found. Please run seed-pricing.ts first.");
    return;
  }

  // Create a map for easy feature lookup
  const featureMap = new Map(features.map(f => [f.featureKey, f]));

  // Define feature assignments for each tier
  const tierFeatureAssignments: Record<string, Record<string, { enabled: boolean; limitValue?: number; configValue?: any }>> = {
    "FREE": {
      // Basic features for free tier
      "view_articles": { enabled: true },
      "like_articles": { enabled: true },
      "article_search": { enabled: true },
      "daily_ai_chat_limit": { enabled: true, limitValue: 0 },
      "daily_article_generation_limit": { enabled: true, limitValue: 0 },
      "monthly_download_limit": { enabled: true, limitValue: 0 },
      // Disabled features
      "ai_chat": { enabled: false },
      "generate_article_content": { enabled: false },
      "generate_example_questions": { enabled: false },
      "comment_on_articles": { enabled: false },
      "flag_content": { enabled: false },
      "suggest_article_improvements": { enabled: false },
      "manage_curated_lists": { enabled: false },
      "article_groups": { enabled: false },
      "view_article_analytics": { enabled: false },
      "priority_support": { enabled: false },
      "view_change_history": { enabled: false },
    },
    "STANDARD": {
      // All basic features plus more
      "view_articles": { enabled: true },
      "like_articles": { enabled: true },
      "article_search": { enabled: true },
      "ai_chat": { enabled: true },
      "comment_on_articles": { enabled: true },
      "flag_content": { enabled: true },
      "suggest_article_improvements": { enabled: true },
      "manage_curated_lists": { enabled: true },
      "article_groups": { enabled: true },
      "view_article_analytics": { enabled: true },
      "view_change_history": { enabled: true },
      // Limited AI features
      "generate_article_content": { enabled: false },
      "generate_example_questions": { enabled: false },
      "daily_ai_chat_limit": { enabled: true, limitValue: 50 },
      "daily_article_generation_limit": { enabled: true, limitValue: 0 },
      "monthly_download_limit": { enabled: true, limitValue: 100 },
      "priority_support": { enabled: false },
    },
    "PRO": {
      // Everything in Standard plus AI features
      "view_articles": { enabled: true },
      "like_articles": { enabled: true },
      "article_search": { enabled: true },
      "ai_chat": { enabled: true },
      "comment_on_articles": { enabled: true },
      "flag_content": { enabled: true },
      "suggest_article_improvements": { enabled: true },
      "manage_curated_lists": { enabled: true },
      "article_groups": { enabled: true },
      "view_article_analytics": { enabled: true },
      "view_change_history": { enabled: true },
      "generate_article_content": { enabled: true },
      "generate_example_questions": { enabled: true },
      "priority_support": { enabled: true },
      "daily_ai_chat_limit": { enabled: true, limitValue: 200 },
      "daily_article_generation_limit": { enabled: true, limitValue: 5 },
      "monthly_download_limit": { enabled: true, limitValue: 500 },
    },
    "MAX": {
      // Everything unlimited
      "view_articles": { enabled: true },
      "like_articles": { enabled: true },
      "article_search": { enabled: true },
      "ai_chat": { enabled: true },
      "comment_on_articles": { enabled: true },
      "flag_content": { enabled: true },
      "suggest_article_improvements": { enabled: true },
      "manage_curated_lists": { enabled: true },
      "article_groups": { enabled: true },
      "view_article_analytics": { enabled: true },
      "view_change_history": { enabled: true },
      "generate_article_content": { enabled: true },
      "generate_example_questions": { enabled: true },
      "priority_support": { enabled: true },
      "daily_ai_chat_limit": { enabled: true, limitValue: -1 }, // -1 = unlimited
      "daily_article_generation_limit": { enabled: true, limitValue: -1 },
      "monthly_download_limit": { enabled: true, limitValue: -1 },
    },
  };

  // Process each pricing tier
  for (const tier of pricingTiers) {
    const assignments = tierFeatureAssignments[tier.tier.toUpperCase()];
    
    if (!assignments) {
      console.log(`⚠️  No feature assignments defined for tier: ${tier.tier}`);
      continue;
    }

    console.log(`\nProcessing tier: ${tier.tier}`);
    
    for (const [featureKey, assignment] of Object.entries(assignments)) {
      const feature = featureMap.get(featureKey);
      
      if (!feature) {
        console.log(`⚠️  Feature not found: ${featureKey}`);
        continue;
      }

      await prisma.pricingTierFeature.upsert({
        where: {
          pricingTierId_featureId: {
            pricingTierId: tier.pricingId,
            featureId: feature.featureId,
          },
        },
        update: {
          isEnabled: assignment.enabled,
          limitValue: assignment.limitValue || null,
          configValue: assignment.configValue || null,
        },
        create: {
          pricingTierId: tier.pricingId,
          featureId: feature.featureId,
          isEnabled: assignment.enabled,
          limitValue: assignment.limitValue || null,
          configValue: assignment.configValue || null,
        },
      });

      console.log(`  ✅ ${featureKey}: ${assignment.enabled ? 'enabled' : 'disabled'}${assignment.limitValue !== undefined ? ` (limit: ${assignment.limitValue})` : ''}`);
    }
  }

  console.log("\n✅ Pricing tier features seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding pricing tier features:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });