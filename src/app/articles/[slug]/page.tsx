import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ArticleContent from "./article-content";

interface PageProps {
  params: Promise<{ slug: string }>;
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

  return <ArticleContent article={article} />;
}