import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { openai, AISearchResponse } from "@/lib/openai";
import { slugify } from "@/lib/utils";

export async function POST(request: Request) {
  console.log("Search endpoint hit");
  
  try {
    const user = await currentUser();
    let userId: string | null = null;
    
    // Check if user exists in database and create if not
    if (user?.id && user?.emailAddresses?.[0]?.emailAddress) {
      try {
        const dbUser = await prisma.user.upsert({
          where: { clerkUserId: user.id },
          update: {
            lastLoginToApp: new Date()
          },
          create: {
            clerkUserId: user.id,
            email: user.emailAddresses[0].emailAddress,
            username: user.username || null
          }
        });
        userId = dbUser.clerkUserId;
      } catch (err) {
        console.error("Error syncing user:", err);
        // Continue without user ID
      }
    }
    
    const body = await request.json();
    const { query } = body;
    
    console.log("Search query:", query);
    console.log("User ID:", userId);

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    // Search local database
    const [categories, articles] = await Promise.all([
      prisma.category.findMany({
        where: {
          OR: [
            { categoryName: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        }
      }),
      prisma.article.findMany({
        where: {
          OR: [
            { articleTitle: { contains: query, mode: 'insensitive' } },
            { contentHtml: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: { category: true }
      })
    ]);
    
    console.log("Database results:", { 
      categoriesFound: categories.length, 
      articlesFound: articles.length 
    });

    // Prepare context for AI
    const existingCategoryNames = categories.map(c => c.categoryName);
    const existingArticleTitles = articles.map(a => a.articleTitle);

    // Call AI for suggestions
    const aiPrompt = `Analyze this search query: "${query}"

IMPORTANT: First determine if this query is related to IT/technology/programming/computing. If it's NOT related to technology (e.g., adult content, non-tech topics), return empty arrays.

Current database content:
- Categories: ${JSON.stringify(existingCategoryNames)}
- Articles: ${JSON.stringify(existingArticleTitles)}

If the query IS technology-related, suggest NEW categories and article titles that would help users learn about this topic. Don't repeat existing content.

Response format:
{
  "suggested_new_categories": [
    {"name": "Category Name", "description": "Brief description"}
  ],
  "suggested_new_article_titles": [
    {"title": "Article Title", "target_category_name": "Category Name"}
  ]
}`;

    let aiResponse: AISearchResponse = {
      suggested_new_categories: [],
      suggested_new_article_titles: []
    };

    try {
      console.log("Calling OpenAI...");
      const completion = await openai.chat.completions.create({
        model: "gpt-4-0125-preview",
        messages: [
          {
            role: "system",
            content: "You are an IT learning platform assistant. Only suggest content for technology, programming, IT, and computing topics. For non-tech queries, return empty arrays. Always respond in valid JSON format with the exact structure requested."
          },
          {
            role: "user",
            content: aiPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1000
      });

      console.log("OpenAI response received");
      aiResponse = JSON.parse(completion.choices[0].message.content || "{}");
      console.log("AI suggestions:", {
        categoriesCount: aiResponse.suggested_new_categories?.length || 0,
        articlesCount: aiResponse.suggested_new_article_titles?.length || 0
      });
    } catch (aiError) {
      console.error("AI call failed:", aiError);
      // Continue with database results only
    }

    // Persist new categories and articles
    const newCategories = [];
    const newArticles = [];

    // Add new categories
    for (const suggestedCategory of aiResponse.suggested_new_categories || []) {
      const existingCategory = await prisma.category.findUnique({
        where: { categoryName: suggestedCategory.name }
      });

      if (!existingCategory) {
        const newCategory = await prisma.category.create({
          data: {
            categoryName: suggestedCategory.name,
            description: suggestedCategory.description
          }
        });
        newCategories.push(newCategory);
      }
    }

    // Add new articles
    for (const suggestedArticle of aiResponse.suggested_new_article_titles || []) {
      // Find or create the category
      let category = await prisma.category.findUnique({
        where: { categoryName: suggestedArticle.target_category_name }
      });

      if (!category) {
        category = await prisma.category.create({
          data: {
            categoryName: suggestedArticle.target_category_name,
            description: `Category for ${suggestedArticle.target_category_name}`
          }
        });
      }

      const articleSlug = slugify(suggestedArticle.title);
      const existingArticle = await prisma.article.findUnique({
        where: { articleSlug }
      });

      if (!existingArticle) {
        const newArticle = await prisma.article.create({
          data: {
            categoryId: category.categoryId,
            articleTitle: suggestedArticle.title,
            articleSlug,
            isContentGenerated: false,
            createdByClerkUserId: userId || null  // Make it null if no user
          },
          include: { category: true }
        });
        newArticles.push(newArticle);
      }
    }

    // Combine all results
    const allCategories = [...categories, ...newCategories];
    const allArticles = [...articles, ...newArticles];

    return NextResponse.json({
      query,
      categories: allCategories,
      articles: allArticles,
      aiSuggestions: {
        newCategoriesAdded: newCategories.length,
        newArticlesAdded: newArticles.length
      }
    });

  } catch (error) {
    console.error("Error in search:", error);
    
    // More detailed error response for debugging
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    return NextResponse.json(
      { 
        error: "Failed to perform search",
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
      },
      { status: 500 }
    );
  }
}