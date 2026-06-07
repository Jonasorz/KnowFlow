import { cn, formatRelativeDate } from '@/lib/utils';
import { Star, Eye, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ArticleInfo } from '@knowflow/shared';
import { useNavigate } from '@tanstack/react-router';
import { useToggleStar, useMarkAsRead } from '@/hooks/use-articles';
import { useMutationState } from '@tanstack/react-query';

interface ArticleCardProps {
  article: ArticleInfo;
  view: 'list' | 'grid';
}

function CoverImage({ src, title }: { src?: string; title: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={title}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
    );
  }

  // Gradient fallback based on title hash
  const hash = title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const gradients = [
    'from-indigo-400 to-purple-500',
    'from-blue-400 to-cyan-500',
    'from-emerald-400 to-teal-500',
    'from-orange-400 to-pink-500',
    'from-violet-400 to-fuchsia-500',
    'from-rose-400 to-red-500',
  ];
  const gradient = gradients[hash % gradients.length];

  return (
    <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br', gradient)}>
      <span className="text-2xl font-bold text-white/80">
        {title.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

export function ArticleCard({ article, view }: ArticleCardProps) {
  const navigate = useNavigate();
  const toggleStar = useToggleStar();
  const markAsRead = useMarkAsRead();

  // Track pending transcriptions globally to show transcribing indicator
  const pendingTranscriptions = useMutationState({
    filters: { mutationKey: ['transcribe-article'], status: 'pending' },
    select: (mutation) => mutation.state.variables as string,
  });
  const isTranscribing = pendingTranscriptions.includes(article.id);

  const handleClick = () => {
    markAsRead(article.id);
    navigate({ to: '/article/$id', params: { id: article.id } });
  };

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleStar(article.id, article.isStarred);
  };

  if (view === 'grid') {
    return (
      <article
        onClick={handleClick}
        className={cn(
          'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card',
          'shadow-card transition-all duration-300 ease-[var(--ease-spring)]',
          'hover:shadow-card-hover hover:-translate-y-0.5',
          !article.isRead && 'ring-1 ring-primary/20'
        )}
      >
        {/* Cover Image */}
        <div className="relative h-40 overflow-hidden bg-muted">
          <CoverImage src={article.coverImageUrl} title={article.title} />
          {/* Read indicator */}
          {!article.isRead && (
            <div className="absolute left-3 top-3">
              <div className="h-2 w-2 rounded-full bg-primary shadow-sm" />
            </div>
          )}
          {/* Transcribing indicator overlay */}
          {isTranscribing && (
            <div className="absolute right-3 top-3 bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md animate-pulse select-none">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>转写中</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-2 p-4">
          {/* Source & Date */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">{article.sourceName || 'Unknown'}</span>
            <span>·</span>
            <span>{article.publishedAt ? formatRelativeDate(article.publishedAt) : ''}</span>
          </div>

          {/* Title */}
          <h3 className="line-clamp-2 font-semibold leading-snug tracking-tight text-card-foreground group-hover:text-primary transition-colors duration-200">
            {article.title}
          </h3>

          {/* Summary */}
          {article.summary && (
            <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed">
              {article.summary}
            </p>
          )}

          {/* Footer */}
          <div className="mt-auto flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              {article.readCount !== undefined && article.readCount > 0 && (
                <Badge variant="muted" className="gap-1">
                  <Eye className="h-3 w-3" />
                  {article.readCount.toLocaleString()}
                </Badge>
              )}
            </div>
            <button
              onClick={handleStarClick}
              className={cn(
                'rounded-md p-1 transition-all duration-200',
                'hover:bg-accent',
                article.isStarred ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'
              )}
            >
              <Star className={cn('h-4 w-4', article.isStarred && 'fill-current')} />
            </button>
          </div>
        </div>
      </article>
    );
  }

  // List view
  return (
    <article
      onClick={handleClick}
      className={cn(
        'group flex cursor-pointer items-start gap-4 rounded-xl px-4 py-3.5',
        'transition-all duration-200 ease-[var(--ease-spring)]',
        'hover:bg-muted/50',
        !article.isRead && 'bg-primary/[0.02]'
      )}
    >
      {/* Unread indicator */}
      <div className="mt-2 flex shrink-0 items-center">
        <div
          className={cn(
            'h-2 w-2 rounded-full transition-all duration-200',
            !article.isRead ? 'bg-primary scale-100' : 'bg-transparent scale-0'
          )}
        />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">{article.sourceName || 'Unknown'}</span>
          <span>·</span>
          <span>{article.publishedAt ? formatRelativeDate(article.publishedAt) : ''}</span>
          {isTranscribing && (
            <span className="ml-auto text-amber-500 font-medium flex items-center gap-1 text-[11px] animate-pulse select-none">
              <Loader2 className="h-3 w-3 animate-spin" />
              转写中
            </span>
          )}
        </div>
        <h3 className={cn(
          'line-clamp-1 font-medium tracking-tight text-card-foreground',
          'group-hover:text-primary transition-colors duration-200',
          !article.isRead && 'font-semibold'
        )}>
          {article.title}
        </h3>
        {article.summary && (
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {article.summary}
          </p>
        )}
      </div>

      {/* Right side */}
      <div className="flex shrink-0 items-center gap-2">
        {article.readCount !== undefined && article.readCount > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {article.readCount.toLocaleString()} reads
          </span>
        )}
        <button
          onClick={handleStarClick}
          className={cn(
            'rounded-md p-1 transition-all duration-200 opacity-0 group-hover:opacity-100',
            article.isStarred && 'opacity-100',
            article.isStarred ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'
          )}
        >
          <Star className={cn('h-4 w-4', article.isStarred && 'fill-current')} />
        </button>
      </div>

      {/* Thumbnail for list view */}
      {article.coverImageUrl && (
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
          <img
            src={article.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
    </article>
  );
}
