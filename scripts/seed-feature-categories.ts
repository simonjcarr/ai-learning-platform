import prisma from '../src/lib/prisma';

const categories = [
  {
    categoryKey: 'CONTENT_MANAGEMENT',
    categoryName: 'Content Management',
    description: 'Article creation, editing, and content management features',
    displayOrder: 1
  },
  {
    categoryKey: 'SOCIAL_FEATURES',
    categoryName: 'Social Features',
    description: 'Comments, likes, flagging, and community interaction features',
    displayOrder: 2
  },
  {
    categoryKey: 'AI_FEATURES',
    categoryName: 'AI Features',
    description: 'AI chat, content generation, and AI-powered features',
    displayOrder: 3
  },
  {
    categoryKey: 'ORGANIZATION',
    categoryName: 'Organization',
    description: 'Lists, groups, tags, and content organization features',
    displayOrder: 4
  },
  {
    categoryKey: 'ANALYTICS',
    categoryName: 'Analytics',
    description: 'Reports, insights, and analytics features',
    displayOrder: 5
  },
  {
    categoryKey: 'LIMITS',
    categoryName: 'Limits',
    description: 'Usage limits and quotas',
    displayOrder: 6
  }
];

async function seedFeatureCategories() {
  console.log('Seeding feature categories...');
  
  try {
    for (const category of categories) {
      await prisma.featureCategory.upsert({
        where: { categoryKey: category.categoryKey },
        update: category,
        create: category
      });
      
      console.log(`✅ Seeded category: ${category.categoryName}`);
    }
    
    console.log('✅ Feature categories seeded successfully!');
  } catch (error) {
    console.error('Error seeding feature categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Export the function for use in other scripts
export { seedFeatureCategories };

// Run if this script is executed directly
if (require.main === module) {
  seedFeatureCategories();
}