import { PrismaClient, FeatureType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding features...");

  // First, get all feature categories
  const categories = await prisma.featureCategory.findMany();
  const categoryMap = new Map<string, string>();
  
  for (const category of categories) {
    categoryMap.set(category.categoryKey, category.categoryId);
  }

  const features = [
    // Content Management Features
    {
      featureKey: "view_articles",
      featureName: "View Articles",
      description: "Access to read articles and learning content",
      categoryKey: "CONTENT_MANAGEMENT",
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: true },
      isActive: true,
    },
    {
      featureKey: "generate_article_content",
      featureName: "Generate Article Content",
      description: "AI-powered article content generation",
      categoryKey: "AI_FEATURES",
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "daily_article_generation_limit",
      featureName: "Daily Article Generation Limit",
      description: "Maximum number of articles that can be generated per day",
      categoryKey: "LIMITS",
      featureType: FeatureType.NUMERIC_LIMIT,
      defaultValue: { limit: 0 },
      isActive: true,
    },
    {
      featureKey: "generate_example_questions",
      featureName: "Generate Example Questions",
      description: "AI-powered interactive quiz question generation",
      categoryKey: "LIMITS",
      featureType: FeatureType.NUMERIC_LIMIT,
      defaultValue: { limit: 0 },
      isActive: true,
    },

    // Social Features
    {
      featureKey: "comment_on_articles",
      featureName: "Comment on Articles",
      description: "Post comments and participate in discussions",
      categoryKey: "SOCIAL_FEATURES",
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "like_articles",
      featureName: "Like Articles",
      description: "Like and bookmark articles",
      categoryKey: "SOCIAL_FEATURES",
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: true },
      isActive: true,
    },
    {
      featureKey: "flag_content",
      featureName: "Flag Content",
      description: "Report inappropriate articles or comments",
      categoryKey: "SOCIAL_FEATURES",
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "suggest_article_improvements",
      featureName: "Suggest Article Improvements",
      description: "Submit suggestions to improve article content",
      categoryKey: "SOCIAL_FEATURES",
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },

    // AI Features
    {
      featureKey: "ai_chat",
      featureName: "AI Chat",
      description: "Chat with AI about article content and get help",
      categoryKey: "AI_FEATURES",
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "daily_ai_chat_limit",
      featureName: "Daily AI Chat Limit",
      description: "Maximum number of AI chat messages per day",
      categoryKey: "LIMITS",
      featureType: FeatureType.NUMERIC_LIMIT,
      defaultValue: { limit: 0 },
      isActive: true,
    },

    // Organization Features
    {
      featureKey: "manage_curated_lists",
      featureName: "Manage Curated Lists",
      description: "Create and manage custom article lists",
      categoryKey: "ORGANIZATION",
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "article_groups",
      featureName: "Article Groups",
      description: "Create and manage groups of related articles",
      categoryKey: "ORGANIZATION",
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "article_search",
      featureName: "Article Search",
      description: "Advanced search functionality for articles",
      categoryKey: "ORGANIZATION",
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: true },
      isActive: true,
    },

    // Analytics Features
    {
      featureKey: "view_article_analytics",
      featureName: "View Article Analytics",
      description: "Access to reading progress and statistics",
      categoryKey: "ANALYTICS",
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "priority_support",
      featureName: "Priority Support",
      description: "Faster response times for support requests",
      categoryKey: "ANALYTICS",
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },

    // Limits and Quotas
    {
      featureKey: "monthly_download_limit",
      featureName: "Monthly Download Limit",
      description: "Maximum number of content downloads per month",
      categoryKey: "LIMITS",
      featureType: FeatureType.NUMERIC_LIMIT,
      defaultValue: { limit: 0 },
      isActive: true,
    },

    {
      featureKey: "view_change_history",
      featureName: "View Change History",
      description: "View article change history and track modifications",
      categoryKey: "CONTENT_MANAGEMENT",
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
  ];

  for (const feature of features) {
    const categoryId = categoryMap.get(feature.categoryKey);
    
    if (!categoryId) {
      console.error(`❌ Category ${feature.categoryKey} not found for feature ${feature.featureKey}`);
      continue;
    }
    
    // Create feature data with categoryId instead of categoryKey
    const { categoryKey, ...featureData } = feature;
    const featureWithCategoryId = {
      ...featureData,
      categoryId
    };
    
    await prisma.feature.upsert({
      where: { featureKey: feature.featureKey },
      update: featureWithCategoryId,
      create: featureWithCategoryId,
    });
    console.log(`✅ Seeded feature: ${feature.featureName}`);
  }

  console.log("✅ Features seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding features:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });