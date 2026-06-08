import { useArticles } from '@/hooks/use-articles';
import { useAppStore } from '@/stores/app-store';
import { ArticleCard } from './article-card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FileText, Inbox, Star, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from '@tanstack/react-router';

function ArticleListSkeleton({ view }: { view: 'list' | 'grid' }) {
  if (view === 'grid') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-0">
            <Skeleton className="h-40 w-full rounded-t-xl rounded-b-none" />
            <div className="flex flex-col gap-2 px-4 pb-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex justify-between pt-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-5 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-4 py-3.5">
          <Skeleton className="mt-2 h-2 w-2 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="h-16 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  const navigate = useNavigate();
  const { currentView } = useAppStore();

  const configs = {
    all: {
      icon: Inbox,
      title: 'No articles yet',
      description: 'Subscribe to your favorite content sources to start reading.',
      action: 'Add Sources',
      onClick: () => navigate({ to: '/sources' }),
    },
    starred: {
      icon: Star,
      title: 'No starred articles',
      description: 'Star articles you want to come back to later.',
      action: null,
      onClick: () => {},
    },
    read: {
      icon: BookOpen,
      title: 'No read articles',
      description: 'Articles you\'ve read will appear here.',
      action: null,
      onClick: () => {},
    },
  };

  const config = configs[currentView];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-6">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
        {config.description}
      </p>
      {config.action && (
        <Button onClick={config.onClick}>
          {config.action}
        </Button>
      )}
    </div>
  );
}

export function ArticleList() {
  const { viewMode } = useAppStore();
  const { data, isLoading, isError, error } = useArticles();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl w-full p-6">
        <ArticleListSkeleton view={viewMode} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl w-full flex flex-col items-center justify-center py-24 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mb-6">
          <FileText className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          {error.message || 'Failed to load articles. Please try again.'}
        </p>
      </div>
    );
  }

  const articles = data?.items || [];

  if (articles.length === 0) {
    return (
      <div className="mx-auto max-w-6xl w-full p-6">
        <EmptyState />
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="mx-auto max-w-6xl w-full p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} view="grid" />
          ))}
        </div>
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-8 pb-4">
            <span className="text-sm text-muted-foreground">
              Showing {articles.length} of {data.total} articles
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl w-full p-6 flex flex-col">
      {articles.map((article, i) => (
        <div key={article.id}>
          <ArticleCard article={article} view="list" />
          {i < articles.length - 1 && (
            <div className="mx-4 border-b border-border/50" />
          )}
        </div>
      ))}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-6">
          <span className="text-sm text-muted-foreground">
            Showing {articles.length} of {data.total} articles
          </span>
        </div>
      )}
    </div>
  );
}
