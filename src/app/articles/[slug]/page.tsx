import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import ArticleContent from "./article-content";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.article.findUnique({
    where: { articleSlug: slug },
    select: {
      articleTitle: true,
      seoTitle: true,
      seoDescription: true,
      seoKeywords: true,
      seoCanonicalUrl: true,
      seoImageUrl: true,
      seoImageAlt: true,
      seoNoIndex: true,
      seoNoFollow: true,
      seoLastModified: true,
      updatedAt: true,
      categories: {
        include: {
          category: true
        }
      }
    },
  });

  if (!article) {
    return {
      title: 'Article Not Found',
      description: 'The requested article could not be found.',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://yourdomain.com';
  const fullUrl = `${baseUrl}/articles/${slug}`;
  
  const title = article.seoTitle || article.articleTitle;
  const description = article.seoDescription || `Learn about ${article.articleTitle}. Comprehensive guide with examples and best practices.`;
  const keywords = article.seoKeywords?.join(', ') || '';
  const lastModified = article.seoLastModified || article.updatedAt;
  
  // Get primary category for additional context
  const primaryCategory = article.categories?.[0]?.category?.categoryName;

  return {
    title,
    description,
    keywords,
    authors: [{ name: 'IT Learning Platform' }],
    category: primaryCategory,
    openGraph: {
      title,
      description,
      url: fullUrl,
      siteName: 'IT Learning Platform',
      type: 'article',
      images: article.seoImageUrl ? [{
        url: article.seoImageUrl,
        alt: article.seoImageAlt || title,
      }] : [],
      modifiedTime: lastModified.toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: article.seoImageUrl ? [article.seoImageUrl] : [],
    },
    alternates: {
      canonical: article.seoCanonicalUrl || fullUrl,
    },
    robots: {
      index: !article.seoNoIndex,
      follow: !article.seoNoFollow,
      googleBot: {
        index: !article.seoNoIndex,
        follow: !article.seoNoFollow,
      },
    },
    other: {
      'article:modified_time': lastModified.toISOString(),
      'article:section': primaryCategory || 'Technology',
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await prisma.article.findUnique({
    where: { articleSlug: slug },
    include: {
      categories: {
        include: {
          category: true
        }
      },
      stream: {
        include: {
          channel: true
        }
      },
      createdBy: true,
      tags: {
        include: {
          tag: true
        }
      }
    }
  });

  if (!article) {
    notFound();
  }

  // Generate structured data on server side to avoid hydration issues
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://yourdomain.com';
  const articleUrl = `${baseUrl}/articles/${article.articleSlug}`;
  const primaryCategory = article.categories?.[0]?.category?.categoryName;
  
  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.seoTitle || article.articleTitle,
    "description": article.seoDescription || `Learn about ${article.articleTitle}. Comprehensive guide with examples and best practices.`,
    "author": {
      "@type": "Organization",
      "name": "IT Learning Platform"
    },
    "publisher": {
      "@type": "Organization",
      "name": "IT Learning Platform",
      "url": baseUrl
    },
    "datePublished": article.createdAt.toISOString(),
    "dateModified": (article.seoLastModified || article.updatedAt).toISOString(),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": articleUrl
    },
    "url": articleUrl,
    "keywords": article.seoKeywords?.join(', ') || '',
    "articleSection": primaryCategory || 'Technology',
    ...(article.seoImageUrl && {
      "image": {
        "@type": "ImageObject",
        "url": article.seoImageUrl,
        "alt": article.seoImageAlt || article.articleTitle
      }
    })
  };

  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": baseUrl
      },
      ...(primaryCategory ? [
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Categories",
          "item": `${baseUrl}/categories`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": primaryCategory,
          "item": `${baseUrl}/categories/${article.categories[0].category.categoryId}`
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": article.articleTitle,
          "item": articleUrl
        }
      ] : [
        {
          "@type": "ListItem",
          "position": 2,
          "name": article.articleTitle,
          "item": articleUrl
        }
      ])
    ]
  };

  return (
    <>
      {/* SEO Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleStructuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
      />
      <ArticleContent article={article} />
    </>
  );
}