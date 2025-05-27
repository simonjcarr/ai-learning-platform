import { use } from 'react';
import CategoryArticlesClientPage from './client-page';

export default function CategoryArticlesPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = use(params);
  
  return <CategoryArticlesClientPage categoryId={categoryId} />;
}