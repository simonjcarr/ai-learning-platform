import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { aiService, type AISearchResponse } from "@/lib/ai-service";
import { slugify } from "@/lib/utils";
import { addSitemapToQueue } from "@/lib/bullmq";

// Configuration for content generation thresholds
const CONTENT_THRESHOLDS = {
  MIN_CATEGORIES: 2,        // Minimum categories before skipping AI
  MIN_ARTICLES: 5,          // Minimum articles before skipping AI  
  MAX_ARTICLES_PER_SEARCH: 30, // Maximum articles to show per search
  MAX_NEW_ARTICLES_PER_CALL: 5, // Maximum new articles to create per AI call
  DEFAULT_PAGE_SIZE: 20,    // Default number of results per page
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

    // STEP 1: Extract keywords using AI
    console.log("Extracting keywords from query using AI...");
    let searchKeywords: string[] = [];
    let searchIntent = '';
    
    try {
      const keywordResponse = await aiService.extractSearchKeywords(query, userId);
      searchKeywords = keywordResponse.keywords;
      searchIntent = keywordResponse.search_intent;
      console.log("AI extracted keywords:", searchKeywords);
      console.log("Search intent:", searchIntent);
    } catch (err) {
      console.error("Keyword extraction failed, falling back to basic parsing:", err);
      // Fallback to basic keyword extraction
      searchKeywords = query.trim().toLowerCase().split(/\s+/).filter(word => word.length > 2);
    }
    
    // STEP 2: Search database using keywords
    console.log("Searching database with extracted keywords...");
    
    const [categories, articlesRaw] = await Promise.all([
      // Search categories
      prisma.category.findMany({
        where: {
          OR: [
            // Exact query match
            { categoryName: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            // Keyword matches
            ...searchKeywords.flatMap(keyword => [
              { categoryName: { contains: keyword, mode: 'insensitive' } },
              { description: { contains: keyword, mode: 'insensitive' } }
            ])
          ]
        }
      }),
      // Search articles
      prisma.article.findMany({
        where: {
          OR: [
            // Exact query matches
            { articleTitle: { contains: query, mode: 'insensitive' } },
            { 
              AND: [
                { contentHtml: { not: null } },
                { contentHtml: { contains: query, mode: 'insensitive' } }
              ]
            },
            // Tag-based search (when query starts with #)
            ...(query.startsWith('#') ? [{
              tags: {
                some: {
                  tag: {
                    tagName: {
                      contains: query.slice(1), // Remove the # prefix
                      mode: 'insensitive' as const
                    }
                  }
                }
              }
            }] : []),
            // Keyword matches in title and content
            ...searchKeywords.flatMap(keyword => [
              { articleTitle: { contains: keyword, mode: 'insensitive' } },
              {
                AND: [
                  { contentHtml: { not: null } },
                  { contentHtml: { contains: keyword, mode: 'insensitive' } }
                ]
              },
              // Search by tag names in keywords as well
              {
                tags: {
                  some: {
                    tag: {
                      tagName: {
                        contains: keyword,
                        mode: 'insensitive' as const
                      }
                    }
                  }
                }
              }
            ])
          ]
        },
        include: { 
          categories: {
            include: {
              category: true
            }
          },
          tags: {
            include: {
              tag: true
            }
          }
        }
      })
    ]);
    
    // STEP 3: Score articles based on keyword relevance
    console.log("Scoring articles based on keyword matches...");
    
    const articleScores = new Map<string, { article: any, score: number }>();
    
    articlesRaw.forEach(article => {
      const titleLower = article.articleTitle.toLowerCase();
      const categoryNames = article.categories?.map(c => c.category.categoryName.toLowerCase()) || [];
      const contentLower = article.contentHtml?.toLowerCase() || '';
      const tagNames = article.tags?.map(t => t.tag.tagName.toLowerCase()) || [];
      let score = 0;
      
      // Skip articles from clearly different technology categories
      const queryLower = query.toLowerCase();
      const hasConflictingCategory = categoryNames.some(catName => {
        if (queryLower === 'docker' && catName.includes('docker swarm')) return true;
        if (queryLower === 'kubernetes' && catName.includes('openshift')) return true;
        if (queryLower === 'git' && (catName.includes('github') || catName.includes('gitlab'))) return true;
        return false;
      });
      
      if (hasConflictingCategory) {
        return;
      }
      
      // Scoring based on matches
      // Exact query match in title = highest score
      if (titleLower.includes(query.toLowerCase())) {
        score += 100;
      }
      
      // Exact query match in content = very high score
      if (contentLower && contentLower.includes(query.toLowerCase())) {
        score += 80;
      }
      
      // Keyword matches in title
      const titleKeywordMatches = searchKeywords.filter(keyword => 
        titleLower.includes(keyword.toLowerCase())
      ).length;
      score += titleKeywordMatches * 10;
      
      // Keyword matches in content (with bonus for having content)
      if (contentLower) {
        const contentKeywordMatches = searchKeywords.filter(keyword => 
          contentLower.includes(keyword.toLowerCase())
        ).length;
        score += contentKeywordMatches * 15; // Higher value for content matches
        score += 5; // Bonus for having content at all
      }
      
      // Category relevance bonus
      const categoryMatches = categoryNames.filter(catName => 
        catName.includes(query.toLowerCase())
      ).length;
      score += categoryMatches * 20;

      // Tag-based scoring (very high value for tag matches)
      if (query.startsWith('#')) {
        const tagQuery = query.slice(1).toLowerCase();
        if (tagNames.some(tag => tag.includes(tagQuery))) {
          score += 150; // Very high score for exact tag matches
        }
      } else {
        // Regular keyword matches in tags
        const tagKeywordMatches = searchKeywords.filter(keyword => 
          tagNames.some(tag => tag.includes(keyword.toLowerCase()))
        ).length;
        score += tagKeywordMatches * 25; // High value for tag keyword matches
      }
      
      // Ensure minimum score for any match
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

    // STEP 4: Determine if we need AI-generated content
    const hasSufficientContent = articles.length >= CONTENT_THRESHOLDS.MIN_ARTICLES;
    
    // Check if articles with content actually address the keywords
    const hasRelevantContent = articles.some(article => {
      const content = article.contentHtml?.toLowerCase() || '';
      const title = article.articleTitle.toLowerCase();
      
      if (!content) return false; // No content to check
      
      // Check if the article addresses at least 60% of the extracted keywords
      const keywordMatches = searchKeywords.filter(keyword => 
        content.includes(keyword.toLowerCase()) || title.includes(keyword.toLowerCase())
      ).length;
      
      return keywordMatches >= Math.max(1, searchKeywords.length * 0.6);
    });

    let aiResponse: AISearchResponse = {
      suggested_new_categories: [],
      suggested_new_article_titles: []
    };

    const shouldCallAI = !hasSufficientContent || !hasRelevantContent;
    
    if (shouldCallAI) {
      console.log(`Need AI content generation. Sufficient articles: ${hasSufficientContent}, Relevant content: ${hasRelevantContent}`);
      
      const articlesNeeded = articles.length <= LOW_RESULTS_THRESHOLD 
        ? AI_ARTICLES_LOW_RESULTS 
        : AI_ARTICLES_HIGH_RESULTS;
      
      console.log(`Will generate ${articlesNeeded} new articles targeting keywords: ${searchKeywords.join(', ')}`);

      try {
        console.log('Calling AI for search suggestions...');
        
        // Fetch ALL categories for AI context
        const allCategories = await prisma.category.findMany({
          select: {
            categoryName: true,
            description: true
          }
        });
        
        const existingContent = {
          categories: categories.map(c => c.categoryName),
          articles: articles.map(a => ({ 
            title: a.articleTitle, 
            category: a.categories?.[0]?.category?.categoryName || 'No category'
          }))
        };

        // Enhanced query with keywords for better AI suggestions
        const enhancedQuery = `${query} (related keywords: ${searchKeywords.join(', ')})`;

        aiResponse = await aiService.generateSearchSuggestions(
          enhancedQuery, 
          allCategories,
          existingContent.articles,
          articlesNeeded,
          userId
        );
        
        console.log("AI suggestions:", {
          categoriesCount: aiResponse.suggested_new_categories?.length || 0,
          articlesCount: aiResponse.suggested_new_article_titles?.length || 0
        });
      } catch (aiError) {
        console.error("AI call failed:", aiError);
      }
    } else {
      console.log("Sufficient relevant content found, skipping AI call");
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
      // Find or create all categories for this article
      const categories = [];
      const categoryIds = [];
      
      for (const categoryName of suggestedArticle.target_category_names || []) {
        let category = await prisma.category.findUnique({
          where: { categoryName }
        });

        if (!category) {
          category = await prisma.category.create({
            data: {
              categoryName,
              description: `Category for ${categoryName}`
            }
          });
        }
        
        categories.push(category);
        categoryIds.push(category.categoryId);
      }

      const articleSlug = slugify(suggestedArticle.title);
      
      // Check for existing article with same slug
      const existingArticle = await prisma.article.findUnique({
        where: { articleSlug }
      });

      // Also check for similar titles to avoid near-duplicates
      const similarArticles = await prisma.article.findMany({
        where: {
          categories: {
            some: {
              categoryId: {
                in: categoryIds
              }
            }
          },
          articleTitle: {
            contains: suggestedArticle.title.split(' ').slice(0, 3).join(' '),
            mode: 'insensitive'
          }
        }
      });

      const hasSimilarArticle = similarArticles.length > 0;

      if (!existingArticle && !hasSimilarArticle) {
        // Create the article
        const newArticle = await prisma.article.create({
          data: {
            articleTitle: suggestedArticle.title,
            articleSlug,
            isContentGenerated: false,
            createdByClerkUserId: userId || null
          }
        });
        
        // Create article-category relationships
        for (let i = 0; i < categories.length; i++) {
          await prisma.articleCategory.create({
            data: {
              articleId: newArticle.articleId,
              categoryId: categories[i].categoryId,
              isPrimary: categories[i].categoryName === suggestedArticle.primary_category_name
            }
          });
        }
        
        // Fetch the complete article with categories
        const completeArticle = await prisma.article.findUnique({
          where: { articleId: newArticle.articleId },
          include: { 
            categories: {
              include: {
                category: true
              }
            },
            tags: {
              include: {
                tag: true
              }
            }
          }
        });
        
        newArticles.push(completeArticle);
      }
    }

    // Combine all results
    const allCategories = [...categories, ...newCategories];
    const allArticles = [...articles, ...newArticles];

    // AI reordering of results based on query relevance
    let finalArticles = allArticles;
    if (allArticles.length > 1) {
      try {
        console.log("Calling AI to reorder search results for better relevance...");
        const reorderResponse = await aiService.reorderSearchResults(query, allArticles, allCategories, userId);
        
        // Create a map for quick lookup
        const articleMap = new Map(allArticles.map(article => [article.articleId, article]));
        
        // Reorder articles based on AI response
        const reorderedArticles = reorderResponse.reordered_article_ids
          .map(id => articleMap.get(id))
          .filter(article => article !== undefined);
        
        // Add any articles not in the AI response (fallback)
        const reorderedIds = new Set(reorderResponse.reordered_article_ids);
        const remainingArticles = allArticles.filter(article => !reorderedIds.has(article.articleId));
        
        finalArticles = [...reorderedArticles, ...remainingArticles];
        
      } catch (reorderError) {
        console.error("AI reordering failed, using original order:", reorderError);
        // Continue with original order if AI reordering fails
      }
    }
    
    // Calculate pagination using finalArticles (AI reordered)
    const totalArticles = finalArticles.length;
    const totalPages = Math.ceil(totalArticles / pageSize);
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    // Apply pagination to articles
    const paginatedArticles = finalArticles.slice(startIndex, endIndex);
    
    // Prepare pagination metadata
    const pagination = {
      page: pageNumber,
      limit: pageSize,
      total: totalArticles,
      totalPages,
      hasNextPage: pageNumber < totalPages,
      hasPreviousPage: pageNumber > 1
    };

    // Note: Sitemap regeneration is not triggered for stub articles created during search.
    // Sitemap will be updated when articles receive actual content via generation.

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