import { useState } from 'react';
import { cn, formatRelativeDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useDeleteSource, useSyncSource } from '@/hooks/use-sources';
import { EditSourceDialog } from './edit-source-dialog';
import type { SourceInfo } from '@knowflow/shared';
import {
  MoreHorizontal,
  Trash2,
  RefreshCw,
  FileText,
  Clock,
  MessageCircle,
  Edit,
  Twitter,
  Check,
} from 'lucide-react';

interface SourceCardProps {
  source: SourceInfo;
  isBulkEditing?: boolean;
  isSelected?: boolean;
  onSelectToggle?: () => void;
}

export function SourceCard({
  source,
  isBulkEditing = false,
  isSelected = false,
  onSelectToggle,
}: SourceCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const deleteSource = useDeleteSource();
  const syncSource = useSyncSource();

  const sourceTypeLabels: Record<string, string> = {
    wechat: 'WeChat',
    twitter: 'Twitter',
    podcast: 'Podcast',
    video: 'Video',
  };

  return (
    <div
      onClick={isBulkEditing ? onSelectToggle : undefined}
      className={cn(
        'group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5',
        'shadow-card transition-all duration-300 ease-[var(--ease-spring)]',
        'hover:shadow-card-hover hover:-translate-y-0.5',
        isMenuOpen && 'z-30',
        isBulkEditing && 'cursor-pointer select-none',
        isBulkEditing && isSelected && 'border-primary bg-primary/[0.03] ring-1 ring-primary shadow-md'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {source.avatarUrl ? (
          <img
            src={source.avatarUrl}
            alt={source.name}
            className="h-11 w-11 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 ring-2 ring-border">
            {source.type === 'twitter' ? (
              <Twitter className="h-5 w-5 text-primary" />
            ) : (
              <MessageCircle className="h-5 w-5 text-primary" />
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold tracking-tight truncate">{source.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
              {sourceTypeLabels[source.type] || source.type}
            </Badge>
            {source.isActive ? (
              <Badge variant="success" className="text-[10px]">Active</Badge>
            ) : (
              <Badge variant="muted" className="text-[10px]">Inactive</Badge>
            )}
          </div>
        </div>

        {isBulkEditing ? (
          <div
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-200',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground scale-105 shadow-sm'
                : 'border-muted-foreground/30 bg-background/50 hover:border-muted-foreground/60'
            )}
          >
            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
          </div>
        ) : (
          <DropdownMenu onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-70 hover:opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => syncSource.mutate(source.id)}
                disabled={syncSource.isPending}
              >
                <RefreshCw className={cn('h-4 w-4', syncSource.isPending && 'animate-spin')} />
                Sync now
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                <Edit className="h-4 w-4" />
                Edit source
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onClick={() => {
                  if (confirm(`Delete "${source.name}"? This will remove all its articles.`)) {
                    deleteSource.mutate(source.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete source
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Description */}
      {source.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {source.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          <span>{source.articleCount ?? 0} articles</span>
        </div>
        {source.lastSyncAt && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>Synced {formatRelativeDate(source.lastSyncAt)}</span>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <EditSourceDialog
        source={source}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </div>
  );
}
