import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FileText } from "lucide-react";
import { ArticleCard } from "./article-card";

interface PageProps {
  params: Promise<{ categoryId: string }>;
}

export default async function CategoryDetailPage({ params }: PageProps) {
  const { categoryId } = await params;
  const category = await prisma.category.findUnique({
    where: { categoryId },
    include: {
      articles: {
        include: {
          article: {
            include: {
              createdBy: true,
              _count: {
                select: { interactiveExamples: true }
              },
              tags: {
                include: {
                  tag: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!category) {
    notFound();
  }

  const allArticles = category.articles.map(ac => ac.article);
  const publishedArticles = allArticles.filter(a => a.isContentGenerated);
  const pendingArticles = allArticles.filter(a => !a.isContentGenerated);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center space-x-2 text-sm text-gray-600">
          <li>
            <Link href="/" className="hover:text-gray-900">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href="/categories" className="hover:text-gray-900">
              Categories
            </Link>
          </li>
          <li>/</li>
          <li className="text-gray-900 font-medium">{category.categoryName}</li>
        </ol>
      </nav>

      {/* Category Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{category.categoryName}</h1>
        {category.description && (
          <p className="mt-2 text-lg text-gray-600">{category.description}</p>
        )}
        <div className="mt-4 flex items-center text-sm text-gray-500">
          <FileText className="h-4 w-4 mr-1" />
          <span>{allArticles.length} total articles</span>
          <span className="mx-2">•</span>
          <span>{publishedArticles.length} published</span>
          <span className="mx-2">•</span>
          <span>{pendingArticles.length} pending</span>
        </div>
      </div>

      {/* Published Articles */}
      {publishedArticles.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Published Articles</h2>
          <div className="grid gap-4">
            {publishedArticles.map((article) => (
              <ArticleCard key={article.articleId} article={article} />
            ))}
          </div>
        </section>
      )}

      {/* Pending Articles */}
      {pendingArticles.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Content Generation</h2>
          <div className="grid gap-4">
            {pendingArticles.map((article) => (
              <Link
                key={article.articleId}
                href={`/articles/${article.articleSlug}`}
                className="block p-6 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {article.articleTitle}
                    </h3>
                    <p className="text-sm text-amber-600">
                      Content will be generated when you open this article
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-gray-400 ml-4 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {allArticles.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No articles yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Search for topics in this category to generate articles!
          </p>
          <div className="mt-6">
            <Link
              href="/search"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Go to Search
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}