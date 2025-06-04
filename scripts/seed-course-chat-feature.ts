import { PrismaClient, FeatureType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding course AI chat feature...");
  
  // First, check if the feature already exists
  const existingFeature = await prisma.feature.findUnique({
    where: { featureKey: "course_ai_chat" }
  });
  
  if (existingFeature) {
    console.log("✅ Course AI chat feature already exists");
    return;
  }
  
  // Find the Content Management category (where other course features are)
  const contentCategory = await prisma.featureCategory.findUnique({
    where: { categoryKey: "CONTENT_MANAGEMENT" }
  });
  
  if (!contentCategory) {
    console.error("❌ CONTENT_MANAGEMENT category not found!");
    return;
  }
  
  // Create the course AI chat feature
  await prisma.feature.create({
    data: {
      featureKey: "course_ai_chat",
      featureName: "Course AI Chat",
      description: "AI-powered tutoring assistance for course content and quizzes",
      categoryId: contentCategory.categoryId,
      featureType: FeatureType.BOOLEAN,
      defaultValue: { enabled: false },
      isActive: true,
    }
  });
  
  console.log("✅ Course AI chat feature created successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding course chat feature:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });