import { useState } from 'react';
import {
  useSources,
  useSyncAllSources,
  useBulkUpdateTags,
  useBulkDeleteSources,
} from '@/hooks/use-sources';
import { SourceCard } from './source-card';
import { AddSourceDialog } from './add-source-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, RefreshCw, Rss, Tag, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface BulkEditTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (tags: string[], action: 'append' | 'overwrite') => Promise<void>;
  isPending: boolean;
}

function BulkEditTagsDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  isPending,
}: BulkEditTagsDialogProps) {
  const [tagsString, setTagsString] = useState('');
  const [action, setAction] = useState<'append' | 'overwrite'>('append');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedTags = tagsString
      .split(/[\s,，;；]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (parsedTags.length === 0 && action === 'overwrite') {
      // Allow clearing tags in overwrite mode
    } else if (parsedTags.length === 0) {
      setError('请输入至少一个标签');
      return;
    }

    try {
      await onConfirm(parsedTags, action);
      setTagsString('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改标签失败');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>批量修改标签</DialogTitle>
          <DialogDescription>
            为已选择的 {selectedCount} 个订阅源批量设置标签。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              标签 (空格或逗号分隔)
            </label>
            <Input
              placeholder="例如: 科技, AI, 独立开发"
              value={tagsString}
              onChange={(e) => setTagsString(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              操作方式
            </label>
            <div className="flex gap-1 rounded-lg bg-muted p-1 border border-border/50">
              <button
                type="button"
                onClick={() => setAction('append')}
                disabled={isPending}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-xs font-medium transition-all duration-200',
                  action === 'append'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                追加标签 (保留原有)
              </button>
              <button
                type="button"
                onClick={() => setAction('overwrite')}
                disabled={isPending}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-xs font-medium transition-all duration-200',
                  action === 'overwrite'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                覆盖标签 (清除原有)
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '正在保存...' : '确定保存'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<string | 'all' | 'unassigned'>('all');

  const { data: sources, isLoading } = useSources();
  const syncAll = useSyncAllSources();
  const bulkUpdateTags = useBulkUpdateTags();
  const bulkDeleteSources = useBulkDeleteSources();

  const toggleBulkEditing = () => {
    setIsBulkEditing(!isBulkEditing);
    setSelectedIds(new Set());
  };

  const handleSelectToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Get all unique tags across all sources
  const allTags = Array.from(
    new Set(
      (sources || [])
        .flatMap((s) => s.tags || [])
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    )
  );

  // Filter sources based on tag selection
  const filteredSources = (sources || []).filter((source) => {
    if (activeTag === 'all') return true;
    if (activeTag === 'unassigned') {
      return !source.tags || source.tags.length === 0;
    }
    return source.tags && source.tags.includes(activeTag);
  });

  const allIds = filteredSources.map((s) => s.id);
  const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      const next = new Set(selectedIds);
      allIds.forEach((id) => next.delete(id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      allIds.forEach((id) => next.add(id));
      setSelectedIds(next);
    }
  };

  const handleBulkUpdateTags = async (tags: string[], action: 'append' | 'overwrite') => {
    await bulkUpdateTags.mutateAsync({
      ids: Array.from(selectedIds),
      tags,
      action,
    });
    setIsBulkEditing(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (
      confirm(
        `确定批量删除选中的 ${selectedIds.size} 个订阅源吗？\n该操作会同步级联清理所有相关文章、推文和 AI 分析结果，且不可撤销！`
      )
    ) {
      try {
        await bulkDeleteSources.mutateAsync(Array.from(selectedIds));
        setIsBulkEditing(false);
        setSelectedIds(new Set());
      } catch (err) {
        alert(err instanceof Error ? err.message : '批量删除失败');
      }
    }
  };

  return (
    <div className="p-6 pb-28 animate-fade-in">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sources</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your content sources and subscriptions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isBulkEditing ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleBulkEditing}
              className="h-9"
            >
              退出多选
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleBulkEditing}
                className="h-9"
              >
                批量管理
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncAll.mutate(undefined)}
                disabled={syncAll.isPending}
              >
                <RefreshCw className={cn('h-4 w-4', syncAll.isPending && 'animate-spin')} />
                Sync All
              </Button>
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Source
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tag Filters */}
      {!isLoading && sources && sources.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border/50 pb-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-2">
            按标签筛选:
          </span>
          <button
            onClick={() => setActiveTag('all')}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer border select-none",
              activeTag === 'all'
                ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/65 hover:text-foreground"
            )}
          >
            全部 ({sources.length})
          </button>
          
          <button
            onClick={() => setActiveTag('unassigned')}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer border select-none",
              activeTag === 'unassigned'
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-sm font-semibold"
                : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/65 hover:text-foreground"
            )}
          >
            未分配标签 ({sources.filter(s => !s.tags || s.tags.length === 0).length})
          </button>

          {allTags.map((tag) => {
            const count = sources.filter(s => s.tags && s.tags.includes(tag)).length;
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer border select-none",
                  activeTag === tag
                    ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                    : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/65 hover:text-foreground"
                )}
              >
                #{tag} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Sources Grid */}
      {isLoading ? (
        <SourcesSkeleton />
      ) : sources && sources.length > 0 ? (
        <div className="space-y-8">
          {filteredSources.length > 0 ? (
            <>
              {/* WeChat group */}
              {filteredSources.filter(s => s.type === 'wechat').length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    微信公众号 ({filteredSources.filter(s => s.type === 'wechat').length})
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredSources.filter(s => s.type === 'wechat').map((source) => (
                      <SourceCard
                        key={source.id}
                        source={source}
                        isBulkEditing={isBulkEditing}
                        isSelected={selectedIds.has(source.id)}
                        onSelectToggle={() => handleSelectToggle(source.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* X (Twitter) group */}
              {filteredSources.filter(s => s.type === 'twitter').length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-1">
                    <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
                    X (Twitter) ({filteredSources.filter(s => s.type === 'twitter').length})
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredSources.filter(s => s.type === 'twitter').map((source) => (
                      <SourceCard
                        key={source.id}
                        source={source}
                        isBulkEditing={isBulkEditing}
                        isSelected={selectedIds.has(source.id)}
                        onSelectToggle={() => handleSelectToggle(source.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Podcasts group */}
              {filteredSources.filter(s => s.type === 'podcast').length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-1">
                    <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />
                    播客 (Podcast) ({filteredSources.filter(s => s.type === 'podcast').length})
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredSources.filter(s => s.type === 'podcast').map((source) => (
                      <SourceCard
                        key={source.id}
                        source={source}
                        isBulkEditing={isBulkEditing}
                        isSelected={selectedIds.has(source.id)}
                        onSelectToggle={() => handleSelectToggle(source.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Other group */}
              {filteredSources.filter(s => s.type !== 'wechat' && s.type !== 'twitter' && s.type !== 'podcast').length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-1">
                    <span className="h-2 w-2 rounded-full bg-gray-500 shrink-0" />
                    其他 ({filteredSources.filter(s => s.type !== 'wechat' && s.type !== 'twitter' && s.type !== 'podcast').length})
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredSources.filter(s => s.type !== 'wechat' && s.type !== 'twitter' && s.type !== 'podcast').map((source) => (
                      <SourceCard
                        key={source.id}
                        source={source}
                        isBulkEditing={isBulkEditing}
                        isSelected={selectedIds.has(source.id)}
                        onSelectToggle={() => handleSelectToggle(source.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl bg-muted/10">
              <p className="text-sm text-muted-foreground">在该筛选条件下未找到订阅源</p>
              {activeTag !== 'all' && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setActiveTag('all')}
                  className="mt-2 text-primary text-xs"
                >
                  重置筛选条件
                </Button>
              )}
            </div>
          )}
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

      {/* Floating Action Bar */}
      {isBulkEditing && (
        <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 px-4 transition-all duration-300">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/80 p-4 shadow-xl backdrop-blur-md md:flex-row md:items-center md:justify-between md:rounded-full md:px-6 md:py-3.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-foreground">
                已选择 <strong className="text-primary font-semibold text-base px-0.5">{selectedIds.size}</strong> 个订阅源
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAllToggle}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                {isAllSelected ? '取消全选' : '全选'}
              </Button>
            </div>
            
            <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-3 md:border-0 md:pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTagsDialogOpen(true)}
                disabled={selectedIds.size === 0 || bulkUpdateTags.isPending}
                className="h-9 gap-1.5 text-xs"
              >
                <Tag className="h-3.5 w-3.5" />
                修改标签
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || bulkDeleteSources.isPending}
                className="h-9 gap-1.5 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                批量删除
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleBulkEditing}
                className="h-9 text-xs"
              >
                取消
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Source Dialog */}
      <AddSourceDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      {/* Bulk Edit Tags Dialog */}
      <BulkEditTagsDialog
        open={tagsDialogOpen}
        onOpenChange={setTagsDialogOpen}
        selectedCount={selectedIds.size}
        onConfirm={handleBulkUpdateTags}
        isPending={bulkUpdateTags.isPending}
      />
    </div>
  );
}
