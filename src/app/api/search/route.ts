import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { aiService, type AISearchResponse } from "@/lib/ai-service";
import { slugify } from "@/lib/utils";

// Configuration for content generation thresholds
const CONTENT_THRESHOLDS = {
  MIN_CATEGORIES: 2,        // Minimum categories before skipping AI
  MIN_ARTICLES: 5,          // Minimum articles before skipping AI  
  MAX_ARTICLES_PER_SEARCH: 10, // Maximum articles to show per search
  MAX_NEW_ARTICLES_PER_CALL: 5, // Maximum new articles to create per AI call
};

// Environment variables for AI article generation
const AI_ARTICLES_LOW_RESULTS = parseInt(process.env.AI_ARTICLES_LOW_RESULTS || '5'); // When 2 or fewer results
const AI_ARTICLES_HIGH_RESULTS = parseInt(process.env.AI_ARTICLES_HIGH_RESULTS || '2'); // When more than 2 results
const LOW_RESULTS_THRESHOLD = 2; // Threshold for switching between low/high generation counts

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
            { articleTitle: { contains: query, mode: 'insensitive' } }
            // Removed contentHtml search as it may be too heavy on the database
          ]
        },
        include: { category: true }
      })
    ]);
    
    console.log("Database results:", { 
      categoriesFound: categories.length, 
      articlesFound: articles.length 
    });

    // Check if we already have sufficient content
    const hasSufficientContent = 
      categories.length >= CONTENT_THRESHOLDS.MIN_CATEGORIES || 
      articles.length >= CONTENT_THRESHOLDS.MIN_ARTICLES;

    // Prepare context for AI
    const existingCategoryNames = categories.map(c => c.categoryName);
    const existingArticleTitles = articles.map(a => a.articleTitle);

    let aiResponse: AISearchResponse = {
      suggested_new_categories: [],
      suggested_new_article_titles: []
    };

    // Only call AI if we don't have sufficient content
    if (!hasSufficientContent) {
      console.log("Insufficient content found, calling AI for suggestions");
      
      // Calculate how many more articles we should generate based on current results
      const articlesNeeded = articles.length <= LOW_RESULTS_THRESHOLD 
        ? AI_ARTICLES_LOW_RESULTS 
        : AI_ARTICLES_HIGH_RESULTS;
      
      console.log(`Found ${articles.length} articles. Will generate ${articlesNeeded} new articles.`);

      // Call AI for suggestions
      try {
        console.log(`Calling AI (${aiService.getProviderInfo().provider})...`);
        
        const existingContent = {
          categories: existingCategoryNames,
          articles: articles.map(a => ({ 
            title: a.articleTitle, 
            category: a.category.categoryName 
          }))
        };

        aiResponse = await aiService.generateSearchSuggestions(
          query, 
          existingCategoryNames,
          existingContent.articles,
          articlesNeeded
        );
        
        console.log("AI suggestions:", {
          categoriesCount: aiResponse.suggested_new_categories?.length || 0,
          articlesCount: aiResponse.suggested_new_article_titles?.length || 0
        });
      } catch (aiError) {
        console.error("AI call failed:", aiError);
        // Continue with database results only
      }
    } else {
      console.log("Sufficient content found in database, skipping AI call");
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
      
      // Check for existing article with same slug
      const existingArticle = await prisma.article.findUnique({
        where: { articleSlug }
      });

      // Also check for similar titles to avoid near-duplicates
      const similarArticles = await prisma.article.findMany({
        where: {
          categoryId: category.categoryId,
          articleTitle: {
            contains: suggestedArticle.title.split(' ').slice(0, 3).join(' '),
            mode: 'insensitive'
          }
        }
      });

      const hasSimilarArticle = similarArticles.length > 0;

      if (!existingArticle && !hasSimilarArticle) {
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