import { useAppStore } from '@/stores/app-store';
import { useSyncAllSources, useSources } from '@/hooks/use-sources';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  LayoutGrid,
  LayoutList,
  RefreshCw,
  Focus,
  ListRestart,
  ArrowUpDown,
  Clock,
  Eye,
  TrendingUp,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    currentView,
    selectedSourceId,
    selectedTag,
    selectedTagSourceId,
    setSelectedTagSourceId,
  } = useAppStore();

  const { data: sources } = useSources();
  const syncAll = useSyncAllSources();

  const getTitle = () => {
    if (selectedSourceId) return 'Source Articles';
    if (selectedTag) return `#${selectedTag}`;
    switch (currentView) {
      case 'starred': return 'Starred';
      case 'read': return 'Read';
      default: return 'All Articles';
    }
  };

  const sortLabels: Record<string, string> = {
    publishedAt: 'Date',
    readCount: 'Popularity',
    createdAt: 'Added',
  };

  const handleSyncCurrent = () => {
    if (selectedSourceId) {
      syncAll.mutate([selectedSourceId]);
    } else if (selectedTag && sources) {
      const tagIds = sources
        .filter((s) => s.tags && s.tags.includes(selectedTag))
        .map((s) => s.id);
      if (tagIds.length > 0) {
        syncAll.mutate(tagIds);
      }
    }
  };

  const tagSources = selectedTag && sources
    ? sources.filter((s) => s.tags && s.tags.includes(selectedTag))
    : [];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 glass">
      {/* Title */}
      <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap">
        {getTitle()}
      </h1>

      {/* Search & Actions */}
      <div className="flex flex-1 items-center justify-end gap-2">
        {/* Source filter within selected tag */}
        {selectedTag && tagSources.length > 0 && (
          <select
            value={selectedTagSourceId || ''}
            onChange={(e) => setSelectedTagSourceId(e.target.value || null)}
            className="h-8 max-w-[180px] rounded-md border border-border bg-muted/50 px-2 text-xs text-foreground outline-none focus:border-border focus:bg-background"
          >
            <option value="">全部订阅源</option>
            {tagSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        )}

        {/* Search */}
        <div className="w-full max-w-xs">
          <Input
            icon={<Search className="h-4 w-4" />}
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 bg-muted/50 border-transparent focus:bg-background focus:border-border"
          />
        </div>

        {/* View Toggle */}
        <div className="flex items-center rounded-lg border border-border p-0.5">
          <Tooltip content="List view" side="bottom">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-md p-1.5 transition-all duration-200',
                viewMode === 'list'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content="Grid view" side="bottom">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-md p-1.5 transition-all duration-200',
                viewMode === 'grid'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" size="icon-sm">
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSortBy('publishedAt')}>
              <Clock className="h-4 w-4" />
              <span className="flex-1">Date</span>
              {sortBy === 'publishedAt' && <span className="text-primary">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('readCount')}>
              <Eye className="h-4 w-4" />
              <span className="flex-1">Popularity</span>
              {sortBy === 'readCount' && <span className="text-primary">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('createdAt')}>
              <TrendingUp className="h-4 w-4" />
              <span className="flex-1">Added</span>
              {sortBy === 'createdAt' && <span className="text-primary">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Order</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setSortOrder('desc')}>
              <ArrowDown className="h-4 w-4" />
              <span className="flex-1">Newest first</span>
              {sortOrder === 'desc' && <span className="text-primary">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOrder('asc')}>
              <ArrowUp className="h-4 w-4" />
              <span className="flex-1">Oldest first</span>
              {sortOrder === 'asc' && <span className="text-primary">✓</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sync Current (Only shown when a source or tag is selected) */}
        {(selectedSourceId || selectedTag) && (
          <Tooltip
            content={selectedSourceId ? '同步当前订阅源' : `同步标签 (#${selectedTag}) 下的订阅源`}
            side="bottom"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleSyncCurrent}
              disabled={syncAll.isPending}
              className="text-primary hover:text-primary hover:bg-primary/10"
            >
              <span className="relative flex h-4 w-4 items-center justify-center">
                <Focus className="h-4 w-4" />
                <RefreshCw
                  className={cn(
                    'absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-background transition-transform',
                    syncAll.isPending && 'animate-spin'
                  )}
                />
              </span>
            </Button>
          </Tooltip>
        )}

        {/* Sync All */}
        <Tooltip content="同步所有订阅源" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => syncAll.mutate(undefined)}
            disabled={syncAll.isPending}
          >
            <ListRestart
              className={cn(
                'h-4 w-4 transition-transform',
                syncAll.isPending && !(selectedSourceId || selectedTag) && 'animate-spin'
              )}
            />
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}
