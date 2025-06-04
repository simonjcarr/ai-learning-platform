#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedQuestionPointSettings() {
  try {
    console.log('🎯 Seeding question point settings...');

    // Check if settings already exist
    const existingSettings = await prisma.questionPointSettings.findFirst({
      where: { settingsId: 'default' },
    });

    if (existingSettings) {
      console.log('✅ Question point settings already exist, skipping seed');
      return;
    }

    // Create default question point settings
    const settings = await prisma.questionPointSettings.create({
      data: {
        settingsId: 'default',
        multipleChoicePoints: 1.0,     // Standard point value for multiple choice
        trueFalsePoints: 1.0,          // Standard point value for true/false
        fillInBlankPoints: 1.5,        // Slightly higher for fill-in-blank (requires recall)
        essayMinPoints: 2.0,           // Minimum points for essay questions
        essayMaxPoints: 5.0,           // Maximum points for essay questions
        essayPassingThreshold: 0.6,    // 60% threshold for essay to be considered "correct"
      },
    });

    console.log('✅ Question point settings created:', settings);
    console.log(`   - Multiple Choice: ${settings.multipleChoicePoints} points`);
    console.log(`   - True/False: ${settings.trueFalsePoints} points`);
    console.log(`   - Fill in Blank: ${settings.fillInBlankPoints} points`);
    console.log(`   - Essay: ${settings.essayMinPoints}-${settings.essayMaxPoints} points`);
    console.log(`   - Essay passing threshold: ${settings.essayPassingThreshold * 100}%`);

  } catch (error) {
    console.error('❌ Error seeding question point settings:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedQuestionPointSettings();
    console.log('🎯 Question point settings seed completed successfully');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export default main;