import { PrismaClient, FeatureCategory, FeatureType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding features...");

  const features = [
    // Content Management Features
    {
      featureKey: "view_articles",
      featureName: "View Articles",
      description: "Access to read articles and learning content",
      category: FeatureCategory.CONTENT_MANAGEMENT,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: true },
      isActive: true,
    },
    {
      featureKey: "generate_article_content",
      featureName: "Generate Article Content",
      description: "AI-powered article content generation",
      category: FeatureCategory.AI_FEATURES,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "daily_article_generation_limit",
      featureName: "Daily Article Generation Limit",
      description: "Maximum number of articles that can be generated per day",
      category: FeatureCategory.LIMITS,
      featureType: FeatureType.NUMERIC_LIMIT,
      defaultValue: { limit: 0 },
      isActive: true,
    },
    {
      featureKey: "generate_example_questions",
      featureName: "Generate Example Questions",
      description: "AI-powered interactive quiz question generation",
      category: FeatureCategory.AI_FEATURES,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },

    // Social Features
    {
      featureKey: "comment_on_articles",
      featureName: "Comment on Articles",
      description: "Post comments and participate in discussions",
      category: FeatureCategory.SOCIAL_FEATURES,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "like_articles",
      featureName: "Like Articles",
      description: "Like and bookmark articles",
      category: FeatureCategory.SOCIAL_FEATURES,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: true },
      isActive: true,
    },
    {
      featureKey: "flag_content",
      featureName: "Flag Content",
      description: "Report inappropriate articles or comments",
      category: FeatureCategory.SOCIAL_FEATURES,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "suggest_article_improvements",
      featureName: "Suggest Article Improvements",
      description: "Submit suggestions to improve article content",
      category: FeatureCategory.SOCIAL_FEATURES,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },

    // AI Features
    {
      featureKey: "ai_chat",
      featureName: "AI Chat",
      description: "Chat with AI about article content and get help",
      category: FeatureCategory.AI_FEATURES,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "daily_ai_chat_limit",
      featureName: "Daily AI Chat Limit",
      description: "Maximum number of AI chat messages per day",
      category: FeatureCategory.LIMITS,
      featureType: FeatureType.NUMERIC_LIMIT,
      defaultValue: { limit: 0 },
      isActive: true,
    },

    // Organization Features
    {
      featureKey: "manage_curated_lists",
      featureName: "Manage Curated Lists",
      description: "Create and manage custom article lists",
      category: FeatureCategory.ORGANIZATION,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "article_groups",
      featureName: "Article Groups",
      description: "Create and manage groups of related articles",
      category: FeatureCategory.ORGANIZATION,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "article_search",
      featureName: "Article Search",
      description: "Advanced search functionality for articles",
      category: FeatureCategory.ORGANIZATION,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: true },
      isActive: true,
    },

    // Analytics Features
    {
      featureKey: "view_article_analytics",
      featureName: "View Article Analytics",
      description: "Access to reading progress and statistics",
      category: FeatureCategory.ANALYTICS,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "priority_support",
      featureName: "Priority Support",
      description: "Faster response times for support requests",
      category: FeatureCategory.ANALYTICS,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },

    // Limits and Quotas
    {
      featureKey: "monthly_download_limit",
      featureName: "Monthly Download Limit",
      description: "Maximum number of content downloads per month",
      category: FeatureCategory.LIMITS,
      featureType: FeatureType.QUOTA,
      defaultValue: { limit: 0 },
      isActive: true,
    },

    // Admin Features
    {
      featureKey: "admin_user_management",
      featureName: "User Management",
      description: "Manage users, roles, and permissions",
      category: FeatureCategory.ADMIN_TOOLS,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "admin_content_management",
      featureName: "Content Management",
      description: "Admin access to manage all content",
      category: FeatureCategory.ADMIN_TOOLS,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "admin_analytics",
      featureName: "Admin Analytics",
      description: "Access to platform analytics and reports",
      category: FeatureCategory.ADMIN_TOOLS,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
    {
      featureKey: "view_change_history",
      featureName: "View Change History",
      description: "View article change history and track modifications",
      category: FeatureCategory.CONTENT_MANAGEMENT,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    },
  ];

  for (const feature of features) {
    await prisma.feature.upsert({
      where: { featureKey: feature.featureKey },
      update: feature,
      create: feature,
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