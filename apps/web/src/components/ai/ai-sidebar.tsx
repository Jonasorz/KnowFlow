import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { useAiStream, useAiResults } from '@/hooks/use-ai';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { SummaryView } from './summary-view';
import { QAChat } from './qa-chat';
import {
  X,
  Sparkles,
  MessageSquare,
  ChevronDown,
  Play,
  Square,
} from 'lucide-react';
import type { AIModel, AISkill } from '@knowflow/shared';

type Tab = 'summary' | 'qa';

const models: { value: AIModel; label: string }[] = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'claude-sonnet', label: 'Claude Sonnet' },
  { value: 'claude-haiku', label: 'Claude Haiku' },
];

export function AiSidebar() {
  const { aiArticleId, closeAiSidebar, aiSidebarWidth } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [selectedModel, setSelectedModel] = useState<AIModel>('deepseek-chat');
  const { content: summaryContent, isStreaming: isSummaryStreaming, startStream: startSummary, stopStream: stopSummary, reset: resetSummary } = useAiStream();
  const { data: existingResults } = useAiResults(aiArticleId || '');

  // Reset summary stream state when switching articles
  useEffect(() => {
    resetSummary();
  }, [aiArticleId, resetSummary]);

  if (!aiArticleId) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'summary', label: 'Summary', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { id: 'qa', label: 'Q&A', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  ];

  const selectedModelLabel = models.find((m) => m.value === selectedModel)?.label || selectedModel;

  const existingSummary = existingResults?.find((r) => r.skillType === 'summary')?.result;
  const displayedSummary = summaryContent || existingSummary || '';

  const handleGenerate = (skill: AISkill) => {
    if (skill === 'summary') {
      startSummary({
        articleId: aiArticleId,
        skill,
        model: selectedModel,
        webSearch: false,
      });
    }
  };

  const isCurrentStreaming = isSummaryStreaming;

  return (
    <div
      className={cn(
        'flex flex-col border-l border-border bg-surface-elevated shrink-0',
        'animate-slide-in-right',
      )}
      style={{
        width: aiSidebarWidth,
      }}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">AI Insights</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={closeAiSidebar}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all duration-200',
              'border-b-2',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Model Selector + Generate */}
      {activeTab !== 'qa' && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" size="sm" className="flex-1 justify-between text-xs">
                {selectedModelLabel}
                <ChevronDown className="h-3 w-3 ml-1 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Select Model</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {models.map((m) => (
                <DropdownMenuItem
                  key={m.value}
                  onClick={() => setSelectedModel(m.value)}
                >
                  <span className="flex-1">{m.label}</span>
                  {selectedModel === m.value && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {isCurrentStreaming ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (activeTab === 'summary') stopSummary();
              }}
            >
              <Square className="h-3 w-3" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => handleGenerate(activeTab as AISkill)}
            >
              <Play className="h-3 w-3" />
              Generate
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {activeTab === 'summary' && (
            <SummaryView
              content={displayedSummary}
              isStreaming={isSummaryStreaming}
            />
          )}
        </div>
        {activeTab === 'qa' && (
          <div className="h-full -mt-4 -mx-0">
            <QAChat articleId={aiArticleId} model={selectedModel} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
