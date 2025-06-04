import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding course chat AI interaction type...");
  
  // Check if the interaction type already exists
  const existingInteraction = await prisma.aIInteractionType.findUnique({
    where: { typeName: "course_chat" }
  });
  
  if (existingInteraction) {
    console.log("✅ Course chat interaction type already exists");
    return;
  }
  
  // Create the course chat interaction type
  await prisma.aIInteractionType.create({
    data: {
      typeName: "course_chat",
      displayName: "Course Article Chat",
      description: "AI tutoring assistance for course content and quizzes",
      maxTokens: 500,
      systemPrompt: `You are an AI tutor helping a student with a course article in an IT/Linux learning platform. 
Your role is to:
1. Answer questions about the course content clearly and concisely
2. Help explain course concepts and guide students through the learning material
3. Help with course quiz questions by guiding students to understand concepts rather than giving direct answers
4. Provide additional context and examples when helpful, keeping them relevant to the course level
5. Help students understand how this article fits into the broader course structure
6. Be encouraging and supportive of their learning journey
7. Never directly give away quiz answers - instead guide the student to understand the concept`,
      temperature: 0.7,
    }
  });
  
  console.log("✅ Course chat AI interaction type created successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding course chat AI interaction:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });