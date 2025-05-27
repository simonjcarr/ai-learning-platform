'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Clock, User, AlertCircle } from "lucide-react";

interface ArticleCardProps {
  article: {
    articleId: string;
    articleSlug: string;
    articleTitle: string;
    createdAt: Date;
    createdBy?: {
      username: string | null;
    } | null;
    _count: {
      interactiveExamples: number;
    };
    tags?: {
      tag: {
        tagId: string;
        tagName: string;
        color: string | null;
        description: string | null;
      };
    }[];
  };
}

export function ArticleCard({ article }: ArticleCardProps) {
  const router = useRouter();

  const handleTagClick = (e: React.MouseEvent, tagName: string) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/search?q=${encodeURIComponent(`#${tagName}`)}`);
  };

  return (
    <Link
      href={`/articles/${article.articleSlug}`}
      className="block p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {article.articleTitle}
          </h3>
          <div className="flex items-center text-sm text-gray-500 space-x-4">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{new Date(article.createdAt).toLocaleDateString()}</span>
            </div>
            {article.createdBy?.username && (
              <div className="flex items-center">
                <User className="h-4 w-4 mr-1" />
                <span>{article.createdBy.username}</span>
              </div>
            )}
            {article._count.interactiveExamples > 0 && (
              <div className="flex items-center text-blue-600">
                <AlertCircle className="h-4 w-4 mr-1" />
                <span>{article._count.interactiveExamples} examples</span>
              </div>
            )}
          </div>
          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {article.tags.map(({ tag }) => (
                <button
                  key={tag.tagId}
                  onClick={(e) => handleTagClick(e, tag.tagName)}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white hover:opacity-80 transition-opacity"
                  style={{ 
                    backgroundColor: tag.color || '#3B82F6',
                  }}
                  title={tag.description ? `${tag.description} - Click to find more articles with this tag` : `Click to find more articles with #${tag.tagName}`}
                >
                  #{tag.tagName}
                </button>
              ))}
            </div>
          )}
        </div>
        <FileText className="h-5 w-5 text-gray-400 ml-4 flex-shrink-0" />
      </div>
    </Link>
  );
}