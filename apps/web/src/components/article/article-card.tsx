import { useEffect, useState } from 'react';
import { cn, formatRelativeDate } from '@/lib/utils';
import { Star, Loader2 } from 'lucide-react';
import type { ArticleInfo } from '@knowflow/shared';
import { useNavigate } from '@tanstack/react-router';
import { useToggleStar, useMarkAsRead } from '@/hooks/use-articles';
import { useMutationState } from '@tanstack/react-query';

interface ArticleCardProps {
  article: ArticleInfo;
}

function isLikelyBlockedWechatCover(src?: string, sourceType?: string): boolean {
  if (!src || sourceType !== 'wechat') return false;

  try {
    const hostname = new URL(src).hostname;
    return hostname.includes('mmbiz.qpic.cn') || hostname.includes('mmbiz.qlogo.cn');
  } catch {
    return src.includes('mmbiz.qpic.cn') || src.includes('mmbiz.qlogo.cn');
  }
}

function ListThumbnail({ article }: { article: ArticleInfo }) {
  const [hasImageError, setHasImageError] = useState(false);
  const shouldSkipImage = isLikelyBlockedWechatCover(article.coverImageUrl, article.sourceType);
  const canShowImage = article.coverImageUrl && !shouldSkipImage && !hasImageError;

  useEffect(() => {
    setHasImageError(false);
  }, [article.coverImageUrl]);

  if (!canShowImage) {
    return null;
  }

  return (
    <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
      <img
        src={article.coverImageUrl}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setHasImageError(true)}
      />
    </div>
  );
}

export function ArticleCard({ article }: ArticleCardProps) {
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
      {article.coverImageUrl && <ListThumbnail article={article} />}
    </article>
  );
}
