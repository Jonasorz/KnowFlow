import { useEffect, useState, useRef } from 'react';
import { useArticle, useToggleStar } from '@/hooks/use-articles';
import { useAppStore } from '@/stores/app-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, formatRelativeDate } from '@/lib/utils';
import {
  ArrowLeft,
  Star,
  Sparkles,
  ExternalLink,
  Share2,
  Clock,
  Eye,
  User,
} from 'lucide-react';
import { useNavigate, useParams } from '@tanstack/react-router';

function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const main = document.querySelector('main');
      if (!main) return;
      const scrollTop = main.scrollTop;
      const scrollHeight = main.scrollHeight - main.clientHeight;
      if (scrollHeight > 0) {
        setProgress(Math.min((scrollTop / scrollHeight) * 100, 100));
      }
    };

    const main = document.querySelector('main');
    if (main) {
      main.addEventListener('scroll', handleScroll, { passive: true });
      return () => main.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-transparent">
      <div
        className="h-full bg-primary transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function ReaderSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Skeleton className="mb-2 h-4 w-32" />
      <Skeleton className="mb-3 h-10 w-full" />
      <Skeleton className="mb-1 h-10 w-3/4" />
      <div className="flex gap-3 my-6">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Separator className="my-6" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="mb-4 h-4 w-full" />
      ))}
      <Skeleton className="mb-4 h-4 w-2/3" />
      <Skeleton className="my-6 h-48 w-full rounded-xl" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="mb-4 h-4 w-full" />
      ))}
    </div>
  );
}

function cleanArticleHtml(html: string): string {
  if (!html) return '';

  let clean = html;

  // Remove doctype
  clean = clean.replace(/<!DOCTYPE[^>]*>/gi, '');

  // Remove html, head, body tags (keeping their contents)
  clean = clean.replace(/<\/?(html|head|body)[^>]*>/gi, '');

  // Remove script tags to prevent XSS or unwanted scripts
  clean = clean.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');

  // Remove style tags which cause global style bleeding (e.g. body { width: 75% })
  clean = clean.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '');

  // Remove link tags pointing to stylesheets
  clean = clean.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '');

  return clean.trim();
}

export function ArticleReader() {
  const params = useParams({ from: '/article/$id' });
  const { data: article, isLoading } = useArticle(params.id);
  const navigate = useNavigate();
  const toggleStar = useToggleStar();
  const { openAiSidebar } = useAppStore();
  const contentRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return <ReaderSkeleton />;
  }

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h3 className="text-lg font-semibold mb-2">Article not found</h3>
        <Button variant="outline" onClick={() => navigate({ to: '/' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Go back
        </Button>
      </div>
    );
  }

  return (
    <>
      <ReadingProgressBar />

      <article className="animate-fade-in mx-auto max-w-2xl px-6 py-8">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/' })}
          className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        {/* Header */}
        <header className="mb-8">
          {/* Source */}
          <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">{article.sourceName || 'Unknown'}</span>
            {article.sourceType && (
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                {article.sourceType}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold leading-tight tracking-tight mb-4">
            {article.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {article.author && (
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span>{article.author}</span>
              </div>
            )}
            {article.publishedAt && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatRelativeDate(article.publishedAt)}</span>
              </div>
            )}
            {article.readCount !== undefined && article.readCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                <span>{article.readCount.toLocaleString()} reads</span>
              </div>
            )}
          </div>
        </header>

        {/* Action Bar */}
        <div className="mb-8 flex items-center gap-2 rounded-xl bg-muted/50 p-2">
          <Tooltip content={article.isStarred ? 'Unstar' : 'Star'}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleStar(article.id, article.isStarred)}
              className={cn(article.isStarred && 'text-amber-500')}
            >
              <Star className={cn('h-4 w-4', article.isStarred && 'fill-current')} />
              <span>{article.isStarred ? 'Starred' : 'Star'}</span>
            </Button>
          </Tooltip>

          <Tooltip content="AI Summary & Analysis">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openAiSidebar(article.id)}
            >
              <Sparkles className="h-4 w-4" />
              <span>AI Insights</span>
            </Button>
          </Tooltip>

          {article.originalUrl && (
            <Tooltip content="Open original">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(article.originalUrl!, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Original
              </Button>
            </Tooltip>
          )}

          <div className="flex-1" />

          <Tooltip content="Share">
            <Button variant="ghost" size="icon-sm">
              <Share2 className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>

        <Separator className="mb-8" />

        {/* Cover Image */}
        {article.coverImageUrl && (
          <div className="mb-8 overflow-hidden rounded-xl">
            <img
              src={article.coverImageUrl}
              alt={article.title}
              className="w-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div
          ref={contentRef}
          className="prose-reader"
          dangerouslySetInnerHTML={{
            __html: article.contentHtml
              ? cleanArticleHtml(article.contentHtml)
              : article.contentText?.replace(/\n/g, '<br/>') || '<p>No content available.</p>',
          }}
        />

        {/* End spacer */}
        <div className="h-24" />
      </article>
    </>
  );
}
