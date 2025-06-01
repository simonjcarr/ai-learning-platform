import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://yourdomain.com';
  
  const robots = `User-agent: *
Allow: /

# Important pages
Allow: /articles/
Allow: /categories/
Allow: /search

# Disallow admin and user-specific pages
Disallow: /admin/
Disallow: /dashboard/
Disallow: /sign-in/
Disallow: /sign-up/

# Disallow API endpoints
Disallow: /api/

# Sitemap location
Sitemap: ${baseUrl}/api/sitemap

# Crawl delay (optional - 1 second)
Crawl-delay: 1`;

  return new NextResponse(robots, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400', // Cache for 24 hours
    },
  });
}