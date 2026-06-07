import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { useSettings } from '@/hooks/use-settings';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { QAChat } from './qa-chat';
import {
  X,
  MessageSquare,
} from 'lucide-react';
import type { AIModel } from '@knowflow/shared';

export function AiSidebar() {
  const { aiArticleId, closeAiSidebar, aiSidebarWidth } = useAppStore();
  const { data: settings } = useSettings();

  const model: AIModel = settings?.defaultAIModel || 'deepseek-chat';

  if (!aiArticleId) return null;

  return (
    <div
      className={cn(
        'flex flex-col border-l border-border bg-surface-elevated shrink-0 h-full',
        'animate-slide-in-right',
      )}
      style={{
        width: aiSidebarWidth,
      }}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">AI 问答</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={closeAiSidebar}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Model hint */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="text-[11px] text-muted-foreground">
          使用模型: <span className="font-medium text-foreground/80">{model}</span>
          <span className="text-muted-foreground/60 ml-1">(可在设置中更改)</span>
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <QAChat articleId={aiArticleId} model={model} />
      </div>
    </div>
  );
}
