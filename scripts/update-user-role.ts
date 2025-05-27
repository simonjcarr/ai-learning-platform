import { prisma } from "../src/lib/prisma";
import { Role } from "@prisma/client";

async function updateUserRole() {
  const email = process.argv[2];
  const role = process.argv[3] as Role;

  if (!email || !role) {
    console.error("Usage: npm run update-role <email> <role>");
    console.error("Available roles:", Object.values(Role).join(", "));
    process.exit(1);
  }

  if (!Object.values(Role).includes(role)) {
    console.error("Invalid role. Available roles:", Object.values(Role).join(", "));
    process.exit(1);
  }

  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role },
      select: {
        clerkUserId: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
      },
    });

    console.log("✅ User role updated successfully:");
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName || ""} ${user.lastName || ""}`);
    console.log(`   Role: ${user.role}`);
  } catch (error) {
    console.error("❌ Error updating user role:", error);
    if (error instanceof Error && error.message.includes("Record to update not found")) {
      console.error("   User with email", email, "not found");
    }
  } finally {
    await prisma.$disconnect();
  }
}

updateUserRole();