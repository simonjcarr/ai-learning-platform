import { Worker, Job } from 'bullmq';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import Redis from 'ioredis';
import { prisma } from '@/lib/prisma';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const SITEMAP_MAX_ENTRIES = 50000;
const SITEMAP_MAX_SIZE = 10 * 1024 * 1024; // 10MB limit

interface SitemapJobData {
  type: 'regenerate';
  triggerBy?: string;
  articleId?: string;
}

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

// Generate sitemap XML content
function generateSitemapXml(urls: SitemapUrl[]): string {
  const urlElements = urls.map(url => {
    let urlElement = `    <url>\n      <loc>${escapeXml(url.loc)}</loc>\n`;
    
    if (url.lastmod) {
      urlElement += `      <lastmod>${url.lastmod}</lastmod>\n`;
    }
    
    if (url.changefreq) {
      urlElement += `      <changefreq>${url.changefreq}</changefreq>\n`;
    }
    
    if (url.priority) {
      urlElement += `      <priority>${url.priority}</priority>\n`;
    }
    
    urlElement += `    </url>`;
    return urlElement;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;
}

// Generate sitemap index XML
function generateSitemapIndexXml(sitemapFiles: string[], baseUrl: string): string {
  const sitemapElements = sitemapFiles.map(filename => {
    const lastmod = new Date().toISOString().split('T')[0];
    return `    <sitemap>
      <loc>${baseUrl}/api/sitemap/${filename}</loc>
      <lastmod>${lastmod}</lastmod>
    </sitemap>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapElements}
</sitemapindex>`;
}

// Escape XML special characters
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Convert Prisma enum to sitemap string
function mapChangeFreq(changeFreq: string | null): string {
  if (!changeFreq) return 'weekly';
  return changeFreq.toLowerCase();
}

// Process sitemap generation job
async function processSitemapJob(job: Job<SitemapJobData>) {
  console.log(`Processing sitemap job: ${job.id}`);
  
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://yourdomain.com';
    const sitemapDir = join(process.cwd(), 'public', 'sitemaps');
    
    // Ensure sitemap directory exists
    try {
      await mkdir(sitemapDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Get all published articles with SEO data
    const articles = await prisma.article.findMany({
      where: {
        isFlagged: false,
        isContentGenerated: true,
      },
      select: {
        articleSlug: true,
        seoLastModified: true,
        seoChangeFreq: true,
        seoPriority: true,
        seoNoIndex: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    console.log(`Found ${articles.length} articles for sitemap`);

    // Filter out noindex articles
    const indexableArticles = articles.filter(article => !article.seoNoIndex);
    
    // Create sitemap URLs
    const urls: SitemapUrl[] = [
      // Home page
      {
        loc: baseUrl,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: '1.0',
      },
      // Search page
      {
        loc: `${baseUrl}/search`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: '0.8',
      },
      // Categories page
      {
        loc: `${baseUrl}/categories`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.8',
      },
      // Dashboard (lower priority as it's user-specific)
      {
        loc: `${baseUrl}/dashboard`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: '0.5',
      },
      // Article pages
      ...indexableArticles.map(article => ({
        loc: `${baseUrl}/articles/${article.articleSlug}`,
        lastmod: (article.seoLastModified || article.updatedAt).toISOString().split('T')[0],
        changefreq: mapChangeFreq(article.seoChangeFreq),
        priority: (article.seoPriority || 0.7).toString(),
      })),
    ];

    console.log(`Generated ${urls.length} URLs for sitemap`);

    // Split into multiple sitemaps if necessary
    const sitemapFiles: string[] = [];
    const chunks = [];
    
    for (let i = 0; i < urls.length; i += SITEMAP_MAX_ENTRIES) {
      chunks.push(urls.slice(i, i + SITEMAP_MAX_ENTRIES));
    }

    // Generate individual sitemap files
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const sitemapXml = generateSitemapXml(chunk);
      
      // Check size limit
      if (Buffer.byteLength(sitemapXml, 'utf8') > SITEMAP_MAX_SIZE) {
        console.warn(`Sitemap ${i + 1} exceeds size limit, splitting further`);
        // Could implement further splitting here if needed
      }
      
      const filename = chunks.length === 1 ? 'sitemap.xml' : `sitemap-${i + 1}.xml`;
      const filepath = join(sitemapDir, filename);
      
      await writeFile(filepath, sitemapXml, 'utf8');
      sitemapFiles.push(filename);
      
      console.log(`Generated ${filename} with ${chunk.length} URLs`);
    }

    // Generate sitemap index if we have multiple files
    if (sitemapFiles.length > 1) {
      const sitemapIndexXml = generateSitemapIndexXml(sitemapFiles, baseUrl);
      const indexPath = join(sitemapDir, 'sitemap.xml');
      await writeFile(indexPath, sitemapIndexXml, 'utf8');
      
      console.log(`Generated sitemap index with ${sitemapFiles.length} sitemaps`);
    }

    // Store generation metadata in Redis for caching
    const metadata = {
      lastGenerated: new Date().toISOString(),
      totalUrls: urls.length,
      totalFiles: sitemapFiles.length,
      triggerBy: job.data.triggerBy || 'unknown',
    };
    
    await connection.setex('sitemap:metadata', 3600, JSON.stringify(metadata));
    
    console.log(`Sitemap generation completed: ${urls.length} URLs in ${sitemapFiles.length} files`);
    
    return {
      success: true,
      totalUrls: urls.length,
      totalFiles: sitemapFiles.length,
      files: sitemapFiles,
    };
    
  } catch (error) {
    console.error('Sitemap generation failed:', error);
    throw error;
  }
}

// Create and start the worker
export const sitemapWorker = new Worker('sitemap', processSitemapJob, {
  connection: connection.duplicate(),
  concurrency: 1, // Only one sitemap generation at a time
  removeOnComplete: {
    count: 10, // Keep last 10 completed jobs
  },
  removeOnFail: {
    count: 50, // Keep last 50 failed jobs for debugging
  },
});

sitemapWorker.on('completed', (job, result) => {
  console.log(`Sitemap job ${job.id} completed:`, result);
});

sitemapWorker.on('failed', (job, err) => {
  console.error(`Sitemap job ${job?.id} failed:`, err);
});

sitemapWorker.on('error', (err) => {
  console.error('Sitemap worker error:', err);
});

console.log('Sitemap worker started');

export default sitemapWorker;