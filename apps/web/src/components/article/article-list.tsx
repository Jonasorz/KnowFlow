import { useArticles, useToggleStar, useMarkAsRead } from '@/hooks/use-articles';
import { useAppStore } from '@/stores/app-store';
import { ArticleCard } from './article-card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeDate, cn } from '@/lib/utils';
import { FileText, Inbox, Star, BookOpen, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from '@tanstack/react-router';
import type { ArticleInfo } from '@knowflow/shared';

type ArticleViewMode = 'summary' | 'newspaper' | 'list';

function getExcerpt(article: ArticleInfo): string {
  const raw = article.summary || article.contentText || article.transcriptText || '';
  return raw.replace(/\s+/g, ' ').trim();
}

function getNewspaperDeck(article: ArticleInfo): string {
  const excerpt = getExcerpt(article);
  if (excerpt) return excerpt;

  const title = article.title.replace(/\s+/g, ' ').trim();
  if (!title) return '';

  return `围绕「${title}」展开。`;
}

function ArticleListSkeleton({ view }: { view: ArticleViewMode }) {
  if (view === 'newspaper') {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', view === 'summary' && 'rounded-xl border border-border bg-card px-5 py-2')}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={cn('flex items-start gap-4', view === 'summary' ? 'py-5' : 'px-4 py-3.5')}>
          <Skeleton className="mt-2 h-2 w-2 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className={cn('h-5', view === 'summary' ? 'w-2/3' : 'w-3/4')} />
            <Skeleton className="h-4 w-full" />
            {view === 'summary' && <Skeleton className="h-4 w-5/6" />}
          </div>
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

function ArticleMeta({ article }: { article: ArticleInfo }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/70">{article.sourceName || 'Unknown'}</span>
      <span>·</span>
      <span>{article.publishedAt ? formatRelativeDate(article.publishedAt) : ''}</span>
      {article.readCount !== undefined && article.readCount > 0 && (
        <>
          <span>·</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Eye className="h-3 w-3" />
            {article.readCount.toLocaleString()}
          </span>
        </>
      )}
    </div>
  );
}

function StarButton({ article }: { article: ArticleInfo }) {
  const toggleStar = useToggleStar();

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleStar(article.id, article.isStarred);
      }}
      className={cn(
        'rounded-md p-1 transition-all duration-200 hover:bg-accent',
        article.isStarred ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'
      )}
    >
      <Star className={cn('h-4 w-4', article.isStarred && 'fill-current')} />
    </button>
  );
}

function useOpenArticle() {
  const navigate = useNavigate();
  const markAsRead = useMarkAsRead();

  return (article: ArticleInfo) => {
    markAsRead(article.id);
    navigate({ to: '/article/$id', params: { id: article.id } });
  };
}

function SummaryArticle({ article }: { article: ArticleInfo }) {
  const openArticle = useOpenArticle();
  const excerpt = getExcerpt(article);

  return (
    <article
      onClick={() => openArticle(article)}
      className={cn(
        'group grid cursor-pointer grid-cols-[auto_1fr_auto] gap-4 border-b border-border/60 py-5 last:border-b-0',
        'transition-colors duration-200 hover:bg-muted/30 sm:px-1',
        !article.isRead && 'bg-primary/[0.015]'
      )}
    >
      <div className="pt-2">
        <div className={cn('h-2 w-2 rounded-full', !article.isRead ? 'bg-primary' : 'bg-transparent')} />
      </div>
      <div className="min-w-0">
        <ArticleMeta article={article} />
        <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-snug tracking-tight text-card-foreground group-hover:text-primary">
          {article.title}
        </h2>
        {excerpt && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {excerpt}
          </p>
        )}
      </div>
      <div className="flex items-start pt-6">
        <StarButton article={article} />
      </div>
    </article>
  );
}

function NewspaperStory({
  article,
  variant = 'side',
}: {
  article: ArticleInfo;
  variant?: 'lead' | 'side' | 'compact';
}) {
  const openArticle = useOpenArticle();
  const deck = getNewspaperDeck(article);

  if (variant === 'lead') {
    return (
      <article
        onClick={() => openArticle(article)}
        className="group flex min-h-[280px] cursor-pointer flex-col border border-amber-900/15 bg-[#fbf8f2] p-6 transition-colors hover:bg-[#faf4e9]"
      >
        <ArticleMeta article={article} />
        <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-card-foreground group-hover:text-primary sm:text-4xl">
          {article.title}
        </h2>
        {deck && (
          <p className="mt-4 line-clamp-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {deck}
          </p>
        )}
        <div className="mt-auto flex justify-end pt-6">
          <StarButton article={article} />
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={() => openArticle(article)}
      className={cn(
        'group cursor-pointer border-l-2 border-amber-700/60 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/50',
        variant === 'compact' && 'border-l-primary/70'
      )}
    >
      <ArticleMeta article={article} />
      <h3 className="mt-1 line-clamp-2 font-semibold leading-snug tracking-tight group-hover:text-primary">
        {article.title}
      </h3>
      {deck && (
        <p className={cn('mt-2 text-xs leading-relaxed text-muted-foreground', variant === 'compact' ? 'line-clamp-1' : 'line-clamp-2')}>
          {deck}
        </p>
      )}
    </article>
  );
}

function SummaryView({ articles, data }: { articles: ArticleInfo[]; data: { total: number; totalPages: number } | undefined }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col p-6">
      <div className="rounded-xl border border-border bg-card px-5 py-1 shadow-card">
        {articles.map((article) => (
          <SummaryArticle key={article.id} article={article} />
        ))}
      </div>
      <PaginationHint data={data} count={articles.length} />
    </div>
  );
}

function NewspaperView({ articles, data }: { articles: ArticleInfo[]; data: { total: number; totalPages: number } | undefined }) {
  const [lead, ...rest] = articles;
  const sideStories = rest.slice(0, 4);
  const lowerStories = rest.slice(4);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Today Briefing</h2>
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          {lead && <NewspaperStory article={lead} variant="lead" />}
          <div className="grid content-start gap-3">
            {sideStories.map((article) => (
              <NewspaperStory key={article.id} article={article} />
            ))}
          </div>
        </div>
      </div>
      {lowerStories.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">More Stories</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lowerStories.map((article) => (
              <NewspaperStory key={article.id} article={article} variant="compact" />
            ))}
          </div>
        </div>
      )}
      <PaginationHint data={data} count={articles.length} />
    </div>
  );
}

function PaginationHint({ data, count }: { data: { total: number; totalPages: number } | undefined; count: number }) {
  if (!data || data.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-6">
      <span className="text-sm text-muted-foreground">
        Showing {count} of {data.total} articles
      </span>
    </div>
  );
}

export function ArticleList() {
  const { viewMode: rawViewMode } = useAppStore();
  const { data, isLoading, isError, error } = useArticles();
  const viewMode: ArticleViewMode = rawViewMode === 'newspaper' || rawViewMode === 'list' ? rawViewMode : 'summary';

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

  if (viewMode === 'summary') {
    return <SummaryView articles={articles} data={data} />;
  }

  if (viewMode === 'newspaper') {
    return <NewspaperView articles={articles} data={data} />;
  }

  return (
    <div className="mx-auto max-w-6xl w-full p-6 flex flex-col">
      {articles.map((article, i) => (
        <div key={article.id}>
          <ArticleCard article={article} />
          {i < articles.length - 1 && (
            <div className="mx-4 border-b border-border/50" />
          )}
        </div>
      ))}
      <PaginationHint data={data} count={articles.length} />
    </div>
  );
}
