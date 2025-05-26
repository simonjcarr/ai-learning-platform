import { prisma } from "../src/lib/prisma";

async function resetExamples() {
  console.log("Resetting interactive examples...");
  
  try {
    // First delete all user responses
    const deletedResponses = await prisma.userResponse.deleteMany({});
    console.log(`Deleted ${deletedResponses.count} user responses`);
    
    // Then delete all examples
    const deletedExamples = await prisma.interactiveExample.deleteMany({});
    console.log(`Deleted ${deletedExamples.count} examples`);
    
    console.log("Examples reset successfully! New examples will be generated when users visit articles.");
  } catch (error) {
    console.error("Error resetting examples:", error);
  } finally {
    await prisma.$disconnect();
  }
}

resetExamples();