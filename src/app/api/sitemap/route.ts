import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    const sitemapPath = join(process.cwd(), 'public', 'sitemaps', 'sitemap.xml');
    
    try {
      const sitemapContent = await readFile(sitemapPath, 'utf8');
      
      return new NextResponse(sitemapContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
          'X-Robots-Tag': 'noindex', // Don't index the sitemap itself
        },
      });
    } catch (fileError) {
      // If sitemap doesn't exist, return a basic one
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://yourdomain.com';
      const basicSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

      return new NextResponse(basicSitemap, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=300, s-maxage=300', // Cache for 5 minutes when fallback
          'X-Robots-Tag': 'noindex',
        },
      });
    }
  } catch (error) {
    console.error('Error serving sitemap:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}