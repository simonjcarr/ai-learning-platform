import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface RouteParams {
  params: Promise<{ filename: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { filename } = await params;
    
    // Validate filename to prevent directory traversal
    if (!filename || !/^sitemap(-\d+)?\.xml$/.test(filename)) {
      return new NextResponse('Invalid sitemap filename', { status: 400 });
    }
    
    const sitemapPath = join(process.cwd(), 'public', 'sitemaps', filename);
    
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
      return new NextResponse('Sitemap not found', { status: 404 });
    }
  } catch (error) {
    console.error('Error serving sitemap file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}