import { useState } from 'react';
import { useSources, useSyncAllSources } from '@/hooks/use-sources';
import { SourceCard } from './source-card';
import { AddSourceDialog } from './add-source-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, RefreshCw, Rss } from 'lucide-react';
import { cn } from '@/lib/utils';

function SourcesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl border border-border p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-5 w-32" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SourceManager() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { data: sources, isLoading } = useSources();
  const syncAll = useSyncAllSources();

  return (
    <div className="p-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sources</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your content sources and subscriptions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncAll.mutate()}
            disabled={syncAll.isPending}
          >
            <RefreshCw className={cn('h-4 w-4', syncAll.isPending && 'animate-spin')} />
            Sync All
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Source
          </Button>
        </div>
      </div>

      {/* Sources Grid */}
      {isLoading ? (
        <SourcesSkeleton />
      ) : sources && sources.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-6">
            <Rss className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No sources yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
            Add your first content source to start aggregating articles from WeChat and more.
          </p>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Your First Source
          </Button>
        </div>
      )}

      {/* Add Source Dialog */}
      <AddSourceDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}
