import { useAppStore } from '@/stores/app-store';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SyncProgressIndicator() {
  const syncProgress = useAppStore((s) => s.syncProgress);

  if (!syncProgress) return null;

  const { isSyncing, total, current, currentName, newArticlesCount } = syncProgress;
  const progressPercent = total > 0 ? Math.min((current / total) * 100, 100) : 0;

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex w-80 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xl backdrop-blur-md transition-all duration-300 ease-[var(--ease-spring)]',
        'animate-fade-in'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
          <span className="text-xs font-semibold text-foreground">
            {isSyncing ? `Syncing Sources (${current}/${total})` : 'Sync Completed'}
          </span>
        </div>
        {newArticlesCount > 0 && (
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            +{newArticlesCount} articles
          </span>
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-foreground truncate">
          {currentName}
        </p>
        {isSyncing && (
          <p className="text-[10px] text-muted-foreground">
            Please keep the app open while syncing articles.
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
