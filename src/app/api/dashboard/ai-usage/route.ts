import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    // User can see their own data, admins can see all data
    const userFilter = user.role === Role.ADMIN ? {} : { clerkUserId: userId };

    // Get AI interaction summary
    const interactions = await prisma.aIInteraction.findMany({
      where: {
        ...userFilter,
        startedAt: {
          gte: dateFrom
        }
      },
      include: {
        model: {
          select: {
            modelId: true,
            displayName: true,
            provider: true
          }
        },
        interactionType: {
          select: {
            typeId: true,
            displayName: true,
            typeName: true
          }
        },
        user: user.role === Role.ADMIN ? {
          select: {
            clerkUserId: true,
            firstName: true,
            lastName: true,
            email: true
          }
        } : false
      },
      orderBy: {
        startedAt: 'desc'
      }
    });

    // Calculate totals
    const totalCost = interactions.reduce((sum, interaction) => 
      sum + Number(interaction.totalCost), 0
    );
    
    const totalInputTokens = interactions.reduce((sum, interaction) => 
      sum + interaction.inputTokens, 0
    );
    
    const totalOutputTokens = interactions.reduce((sum, interaction) => 
      sum + interaction.outputTokens, 0
    );

    const successfulInteractions = interactions.filter(i => i.isSuccessful).length;
    const failedInteractions = interactions.filter(i => !i.isSuccessful).length;

    // Group by model
    const costsByModel = interactions.reduce((acc, interaction) => {
      const modelKey = interaction.model.displayName;
      if (!acc[modelKey]) {
        acc[modelKey] = {
          cost: 0,
          interactions: 0,
          inputTokens: 0,
          outputTokens: 0
        };
      }
      acc[modelKey].cost += Number(interaction.totalCost);
      acc[modelKey].interactions += 1;
      acc[modelKey].inputTokens += interaction.inputTokens;
      acc[modelKey].outputTokens += interaction.outputTokens;
      return acc;
    }, {} as Record<string, any>);

    // Group by interaction type
    const costsByType = interactions.reduce((acc, interaction) => {
      const typeKey = interaction.interactionType.displayName;
      if (!acc[typeKey]) {
        acc[typeKey] = {
          cost: 0,
          interactions: 0,
          inputTokens: 0,
          outputTokens: 0
        };
      }
      acc[typeKey].cost += Number(interaction.totalCost);
      acc[typeKey].interactions += 1;
      acc[typeKey].inputTokens += interaction.inputTokens;
      acc[typeKey].outputTokens += interaction.outputTokens;
      return acc;
    }, {} as Record<string, any>);

    // Group by user (admin only)
    const costsByUser = user.role === Role.ADMIN ? interactions.reduce((acc, interaction) => {
      const userKey = interaction.clerkUserId || 'System';
      const userName = interaction.user 
        ? `${interaction.user.firstName || ''} ${interaction.user.lastName || ''}`.trim() || interaction.user.email
        : 'System';
      
      if (!acc[userKey]) {
        acc[userKey] = {
          name: userName,
          cost: 0,
          interactions: 0,
          inputTokens: 0,
          outputTokens: 0
        };
      }
      acc[userKey].cost += Number(interaction.totalCost);
      acc[userKey].interactions += 1;
      acc[userKey].inputTokens += interaction.inputTokens;
      acc[userKey].outputTokens += interaction.outputTokens;
      return acc;
    }, {} as Record<string, any>) : {};

    // Daily usage for chart
    const dailyUsage = interactions.reduce((acc, interaction) => {
      const date = interaction.startedAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          cost: 0,
          interactions: 0,
          inputTokens: 0,
          outputTokens: 0
        };
      }
      acc[date].cost += Number(interaction.totalCost);
      acc[date].interactions += 1;
      acc[date].inputTokens += interaction.inputTokens;
      acc[date].outputTokens += interaction.outputTokens;
      return acc;
    }, {} as Record<string, any>);

    // Convert to arrays for charts
    const dailyData = Object.entries(dailyUsage)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        ...data
      }));

    const modelData = Object.entries(costsByModel).map(([model, data]) => ({
      model,
      ...data
    }));

    const typeData = Object.entries(costsByType).map(([type, data]) => ({
      type,
      ...data
    }));

    const userData = Object.entries(costsByUser).map(([userId, data]) => ({
      userId,
      ...data
    }));

    return NextResponse.json({
      summary: {
        totalCost: totalCost.toFixed(6),
        totalInputTokens,
        totalOutputTokens,
        totalInteractions: interactions.length,
        successfulInteractions,
        failedInteractions,
        successRate: interactions.length > 0 ? (successfulInteractions / interactions.length * 100).toFixed(1) : '0'
      },
      charts: {
        daily: dailyData,
        models: modelData,
        types: typeData,
        users: userData
      },
      recentInteractions: interactions.slice(0, 20).map(interaction => ({
        id: interaction.interactionId,
        model: interaction.model.displayName,
        type: interaction.interactionType.displayName,
        cost: Number(interaction.totalCost).toFixed(6),
        inputTokens: interaction.inputTokens,
        outputTokens: interaction.outputTokens,
        duration: interaction.durationMs,
        isSuccessful: interaction.isSuccessful,
        startedAt: interaction.startedAt,
        user: interaction.user ? {
          name: `${interaction.user.firstName || ''} ${interaction.user.lastName || ''}`.trim() || interaction.user.email,
          email: interaction.user.email
        } : null
      }))
    });

  } catch (error) {
    console.error("Error fetching AI usage data:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI usage data" },
      { status: 500 }
    );
  }
}