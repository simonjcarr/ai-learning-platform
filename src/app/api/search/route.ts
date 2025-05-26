import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { aiService, type AISearchResponse } from "@/lib/ai-service";
import { slugify } from "@/lib/utils";

// Configuration for content generation thresholds
const CONTENT_THRESHOLDS = {
  MIN_CATEGORIES: 2,        // Minimum categories before skipping AI
  MIN_ARTICLES: 5,          // Minimum articles before skipping AI  
  MAX_ARTICLES_PER_SEARCH: 30, // Maximum articles to show per search
  MAX_NEW_ARTICLES_PER_CALL: 5, // Maximum new articles to create per AI call
  DEFAULT_PAGE_SIZE: 20,    // Default number of results per page
};

// Common stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'by', 'for', 'from',
  'has', 'have', 'he', 'how', 'in', 'is', 'it', 'its', 'of', 'on', 'or',
  'that', 'the', 'to', 'was', 'will', 'with', 'what', 'when', 'where',
  'which', 'who', 'why', 'can', 'do', 'does', 'did', 'get', 'got', 'has',
  'had', 'make', 'made', 'see', 'saw', 'come', 'came', 'go', 'went', 'take',
  'took', 'know', 'knew', 'think', 'thought', 'use', 'used', 'find', 'found',
  'give', 'gave', 'tell', 'told', 'all', 'also', 'but', 'if', 'into', 'just',
  'not', 'now', 'only', 'other', 'our', 'out', 'so', 'some', 'still', 'such',
  'than', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'too', 'under', 'up', 'very', 'way', 'we', 'well', 'were', 'while',
  'would', 'you', 'your', 'about', 'after', 'again', 'any', 'back', 'because',
  'before', 'being', 'between', 'both', 'could', 'each', 'few', 'first', 'good',
  'great', 'here', 'him', 'his', 'how', 'i', 'me', 'more', 'most', 'much', 'my',
  'new', 'no', 'one', 'over', 'own', 'same', 'she', 'should', 'since', 'two',
  'us', 'want', 'was', 'way', 'we', 'well', 'what', 'when', 'where', 'which',
  'who', 'will', 'with', 'work', 'year', 'years'
]);

// Minimum word length for partial matching
const MIN_WORD_LENGTH_FOR_PARTIAL = 4;

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
    const { query, page = 1, limit = CONTENT_THRESHOLDS.DEFAULT_PAGE_SIZE } = body;
    
    console.log("Search query:", query);
    console.log("User ID:", userId);
    console.log("Pagination:", { page, limit });

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    // Validate pagination parameters
    const pageNumber = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || CONTENT_THRESHOLDS.DEFAULT_PAGE_SIZE));

    // Split query into individual words for fuzzy search
    const allQueryWords = query.trim().toLowerCase().split(/\s+/).filter(word => word.length > 0);
    
    // Filter out stop words for content matching (but keep them for exact phrase matching)
    const queryWords = allQueryWords.filter(word => !STOP_WORDS.has(word));
    
    // If all words were stop words, use the original query
    const effectiveQueryWords = queryWords.length > 0 ? queryWords : allQueryWords;
    
    console.log("Query words after filtering:", effectiveQueryWords);
    
    // Build search conditions for each word
    const buildWordConditions = (word: string, field: string) => {
      const conditions = [];
      
      // Always include exact word match
      conditions.push({ [field]: { contains: word, mode: 'insensitive' } });
      
      // For longer words, also search for partial matches
      if (word.length >= MIN_WORD_LENGTH_FOR_PARTIAL) {
        // Partial match at the beginning of words (with space prefix)
        conditions.push({ [field]: { contains: ` ${word}`, mode: 'insensitive' } });
        
        // Partial match for words that start with our search term
        const prefix = word.substring(0, Math.max(3, word.length - 2));
        conditions.push({ [field]: { contains: prefix, mode: 'insensitive' } });
      }
      
      return conditions;
    };

    // Search local database with improved fuzzy matching
    const [categories, articlesRaw] = await Promise.all([
      prisma.category.findMany({
        where: {
          OR: [
            // Exact substring match (original behavior)
            { categoryName: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            // Flexible fuzzy search: match ANY of the query words
            ...(effectiveQueryWords.length > 0 ? 
              effectiveQueryWords.flatMap(word => [
                ...buildWordConditions(word, 'categoryName'),
                ...buildWordConditions(word, 'description')
              ]) : []
            )
          ]
        }
      }),
      prisma.article.findMany({
        where: {
          OR: [
            // Exact substring match (original behavior)
            { articleTitle: { contains: query, mode: 'insensitive' } },
            // Flexible fuzzy search: match ANY of the query words
            ...(effectiveQueryWords.length > 0 ?
              effectiveQueryWords.flatMap(word => 
                buildWordConditions(word, 'articleTitle')
              ) : []
            )
          ]
        },
        include: { category: true }
      })
    ]);
    
    // Helper function to check if a word matches (exact or partial)
    const wordMatches = (text: string, word: string): boolean => {
      if (text.includes(word)) return true;
      
      // For longer words, check partial matches
      if (word.length >= MIN_WORD_LENGTH_FOR_PARTIAL) {
        const prefix = word.substring(0, Math.max(3, word.length - 2));
        // Check if any word in the text starts with our prefix
        const textWords = text.split(/\s+/);
        return textWords.some(tw => tw.startsWith(prefix));
      }
      
      return false;
    };

    // Score and deduplicate articles
    const articleScores = new Map<string, { article: any, score: number }>();
    
    articlesRaw.forEach(article => {
      const titleLower = article.articleTitle.toLowerCase();
      let score = 0;
      
      // Exact match gets highest score
      if (titleLower === query.toLowerCase()) {
        score = 100;
      }
      // Contains exact query gets high score
      else if (titleLower.includes(query.toLowerCase())) {
        score = 85;
      }
      // Score based on how many words match (not requiring all)
      else {
        const matchedWords = effectiveQueryWords.filter(word => wordMatches(titleLower, word));
        const matchRatio = matchedWords.length / Math.max(1, effectiveQueryWords.length);
        
        // Base score based on match ratio (0-60 points)
        score = Math.round(matchRatio * 60);
        
        // Bonus for matching all words (20 points)
        if (matchedWords.length === effectiveQueryWords.length && effectiveQueryWords.length > 0) {
          score += 20;
        }
        
        // Bonus if words appear in the same order (10 points)
        if (matchedWords.length > 1) {
          const titleWords = titleLower.split(/\s+/);
          let lastIndex = -1;
          let inOrder = true;
          
          for (const matchedWord of matchedWords) {
            const index = titleWords.findIndex(w => wordMatches(w, matchedWord));
            if (index !== -1) {
              if (index <= lastIndex) {
                inOrder = false;
                break;
              }
              lastIndex = index;
            }
          }
          
          if (inOrder) score += 10;
        }
        
        // Penalty for very long titles (they might be less relevant)
        const wordCount = titleLower.split(/\s+/).length;
        if (wordCount > 10) {
          score -= Math.min(10, wordCount - 10);
        }
        
        // Bonus for matching important (non-stop) words
        const importantMatches = queryWords.filter(word => wordMatches(titleLower, word));
        if (importantMatches.length > 0) {
          score += Math.min(10, importantMatches.length * 3);
        }
      }
      
      // Ensure score is at least 1 if there's any match
      if (score > 0) {
        score = Math.max(1, score);
      }
      
      // Keep the highest scoring version of each article
      const existing = articleScores.get(article.articleId);
      if (!existing || existing.score < score) {
        articleScores.set(article.articleId, { article, score });
      }
    });
    
    // Sort articles by score (highest first)
    const articles = Array.from(articleScores.values())
      .sort((a, b) => b.score - a.score)
      .map(item => item.article);
    
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
    
    // Calculate pagination
    const totalArticles = allArticles.length;
    const totalPages = Math.ceil(totalArticles / pageSize);
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    // Apply pagination to articles
    const paginatedArticles = allArticles.slice(startIndex, endIndex);
    
    // Prepare pagination metadata
    const pagination = {
      page: pageNumber,
      limit: pageSize,
      total: totalArticles,
      totalPages,
      hasNextPage: pageNumber < totalPages,
      hasPreviousPage: pageNumber > 1
    };

    return NextResponse.json({
      query,
      categories: allCategories, // Categories are not paginated
      articles: paginatedArticles,
      pagination,
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