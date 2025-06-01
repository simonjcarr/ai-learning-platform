interface StructuredDataProps {
  type: 'article' | 'breadcrumb' | 'organization';
  data: any;
}

export function StructuredData({ type, data }: StructuredDataProps) {
  let structuredData: any;

  switch (type) {
    case 'article':
      structuredData = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": data.title,
        "description": data.description,
        "author": {
          "@type": "Organization",
          "name": "IT Learning Platform"
        },
        "publisher": {
          "@type": "Organization",
          "name": "IT Learning Platform",
          "url": data.baseUrl
        },
        "datePublished": data.publishedTime,
        "dateModified": data.modifiedTime,
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": data.url
        },
        "url": data.url,
        "keywords": data.keywords,
        "articleSection": data.category,
        ...(data.imageUrl && {
          "image": {
            "@type": "ImageObject",
            "url": data.imageUrl,
            "alt": data.imageAlt
          }
        })
      };
      break;

    case 'breadcrumb':
      structuredData = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": data.items.map((item: any, index: number) => ({
          "@type": "ListItem",
          "position": index + 1,
          "name": item.name,
          "item": item.url
        }))
      };
      break;

    case 'organization':
      structuredData = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "IT Learning Platform",
        "url": data.baseUrl,
        "description": "AI-powered IT learning platform with comprehensive tutorials and hands-on examples",
        "sameAs": data.socialLinks || []
      };
      break;

    default:
      return null;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}