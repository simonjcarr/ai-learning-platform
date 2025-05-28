import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SuggestionSettingsForm from "./settings-form";

export default async function SuggestionSettingsPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { role: true }
  });

  if (user?.role !== 'ADMIN') {
    redirect("/");
  }

  const settings = await prisma.suggestionSettings.findFirst();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Suggestion Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure rate limits and badge thresholds for article suggestions
        </p>
      </div>

      <div className="bg-white shadow-sm rounded-lg p-6">
        <SuggestionSettingsForm initialSettings={settings} />
      </div>
    </div>
  );
}