import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings, useTestApiKey, useDajialaBalance } from '@/hooks/use-settings';
import { useAppStore } from '@/stores/app-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Key,
  ChevronDown,
  Check,
  X,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Eye,
  EyeOff,
  Rss,
  Info,
  Coins,
  RefreshCw,
} from 'lucide-react';
import type { AIModel, Settings } from '@knowflow/shared';

interface ApiKeyFieldProps {
  label: string;
  provider: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving?: boolean;
  children?: React.ReactNode;
}

function ApiKeyField({ label, provider, value, onChange, onSave, saving, children }: ApiKeyFieldProps) {
  const [showKey, setShowKey] = useState(false);
  const testKey = useTestApiKey();

  const handleTest = () => {
    if (value) {
      testKey.mutate({ provider, key: value });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-1.5">
          {testKey.data?.valid === true && (
            <Badge variant="success" className="text-[10px]">
              <Check className="h-3 w-3 mr-0.5" /> Valid
            </Badge>
          )}
          {testKey.data?.valid === false && (
            <Badge variant="destructive" className="text-[10px]">
              <X className="h-3 w-3 mr-0.5" /> Invalid
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Input
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter your ${label}...`}
            className="pr-9 font-mono text-xs"
            suffix={
              <button
                onClick={() => setShowKey(!showKey)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            }
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={!value || testKey.isPending}
        >
          {testKey.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            'Test'
          )}
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
        </Button>
      </div>
      {children}
    </div>
  );
}

function DajialaBalanceQuery() {
  const { data, refetch, isFetching, error } = useDajialaBalance();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const handleQuery = async () => {
    const result = await refetch();
    if (result.isSuccess) {
      setLastUpdated(new Date());
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3.5 flex flex-col gap-2.5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Coins className="h-3.5 w-3.5 text-primary" />
          极致了 API 账户余额
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleQuery}
          disabled={isFetching}
          className="h-6 w-6 rounded-md hover:bg-muted"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', isFetching && 'animate-spin')} />
        </Button>
      </div>

      {isFetching && !data && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse py-1">
          <Loader2 className="h-3 w-3 animate-spin text-primary animate-spin-slow" />
          正在查询账户余额...
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive bg-destructive/5 border border-destructive/10 rounded-md p-2">
          查询失败: {error instanceof Error ? error.message : '未知错误'}
        </div>
      )}

      {data && data.code === 0 && (
        <div className="grid grid-cols-2 gap-4 py-1.5">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">剩余额度</span>
            <span className="text-lg font-bold font-mono text-primary mt-0.5">
              ¥ {data.remain_money.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">昨日消耗</span>
            <span className="text-lg font-bold font-mono text-foreground/80 mt-0.5">
              ¥ {data.yesterday_money.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {data && data.code !== 0 && (
        <div className="text-xs text-destructive bg-destructive/5 border border-destructive/10 rounded-md p-2">
          查询返回错误代码: {data.code}
        </div>
      )}

      {lastUpdated && (
        <div className="text-[10px] text-muted-foreground/60 text-right mt-1 font-mono">
          最后更新时间: {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {!data && !isFetching && !error && (
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-muted-foreground">尚未查询余额</span>
          <Button variant="outline" size="sm" onClick={handleQuery} className="text-[11px] h-7 px-2.5">
            立即查询
          </Button>
        </div>
      )}
    </div>
  );
}

const aiModels: { value: AIModel; label: string }[] = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'claude-sonnet', label: 'Claude Sonnet' },
  { value: 'claude-haiku', label: 'Claude Haiku' },
];

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { theme, setTheme } = useAppStore();

  const [formState, setFormState] = useState<Partial<Settings>>({});

  useEffect(() => {
    if (settings) {
      setFormState(settings);
    }
  }, [settings]);

  const handleSaveKey = (key: keyof Settings) => {
    updateSettings.mutate({ [key]: formState[key] });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-8">
        <Skeleton className="h-8 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const themes = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  return (
    <div className="mx-auto max-w-2xl p-6 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Settings</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Configure your API keys, AI model preferences, and appearance.
      </p>

      {/* API Keys Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">API Keys</h2>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <ApiKeyField
            label="极致了 (DaJiaLe) API Key"
            provider="dajiala"
            value={formState.dajialaApiKey || ''}
            onChange={(v) => setFormState((s) => ({ ...s, dajialaApiKey: v }))}
            onSave={() => handleSaveKey('dajialaApiKey')}
            saving={updateSettings.isPending}
          >
            {settings?.dajialaApiKey && (
              <DajialaBalanceQuery />
            )}
          </ApiKeyField>
          <Separator />
          <ApiKeyField
            label="X (Twitter) API Key"
            provider="twitter"
            value={formState.twitterApiKey || ''}
            onChange={(v) => setFormState((s) => ({ ...s, twitterApiKey: v }))}
            onSave={() => handleSaveKey('twitterApiKey')}
            saving={updateSettings.isPending}
          />
          <Separator />
          <ApiKeyField
            label="OpenAI API Key"
            provider="openai"
            value={formState.openaiApiKey || ''}
            onChange={(v) => setFormState((s) => ({ ...s, openaiApiKey: v }))}
            onSave={() => handleSaveKey('openaiApiKey')}
            saving={updateSettings.isPending}
          />
          <Separator />
          <ApiKeyField
            label="Anthropic API Key"
            provider="anthropic"
            value={formState.anthropicApiKey || ''}
            onChange={(v) => setFormState((s) => ({ ...s, anthropicApiKey: v }))}
            onSave={() => handleSaveKey('anthropicApiKey')}
            saving={updateSettings.isPending}
          />
          <Separator />
          <ApiKeyField
            label="DeepSeek API Key"
            provider="deepseek"
            value={formState.deepseekApiKey || ''}
            onChange={(v) => setFormState((s) => ({ ...s, deepseekApiKey: v }))}
            onSave={() => handleSaveKey('deepseekApiKey')}
            saving={updateSettings.isPending}
          />
          <Separator />
          <ApiKeyField
            label="Tavily Search API Key"
            provider="tavily"
            value={formState.tavilyApiKey || ''}
            onChange={(v) => setFormState((s) => ({ ...s, tavilyApiKey: v }))}
            onSave={() => handleSaveKey('tavilyApiKey')}
            saving={updateSettings.isPending}
          />
        </div>
      </section>

      {/* AI Model Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Default AI Model</h2>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" className="w-full justify-between">
                {aiModels.find((m) => m.value === (formState.defaultAIModel || 'deepseek-chat'))?.label || 'Select model'}
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-full min-w-[240px]">
              <DropdownMenuLabel>Select Default Model</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {aiModels.map((model) => (
                <DropdownMenuItem
                  key={model.value}
                  onClick={() => {
                    setFormState((s) => ({ ...s, defaultAIModel: model.value }));
                    updateSettings.mutate({ defaultAIModel: model.value });
                  }}
                >
                  <span className="flex-1">{model.label}</span>
                  {formState.defaultAIModel === model.value && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      {/* AI Prompt Settings Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">AI Summary Prompt Settings</h2>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">System Prompt (系统提示词)</label>
            <textarea
              value={formState.summarySystemPrompt || ''}
              onChange={(e) => setFormState((s) => ({ ...s, summarySystemPrompt: e.target.value }))}
              placeholder="Enter AI system prompt..."
              className="w-full min-h-[120px] text-xs font-mono p-3 rounded-lg border border-border bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <div className="flex justify-end mt-1">
              <Button
                size="sm"
                onClick={() => handleSaveKey('summarySystemPrompt')}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save System Prompt'}
              </Button>
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">User Prompt Template (用户提示词模板)</label>
              <span className="text-[10px] text-muted-foreground font-mono">Use {'{{content}}'} as placeholder</span>
            </div>
            <textarea
              value={formState.summaryUserPrompt || ''}
              onChange={(e) => setFormState((s) => ({ ...s, summaryUserPrompt: e.target.value }))}
              placeholder="Enter user prompt template..."
              className="w-full min-h-[80px] text-xs font-mono p-3 rounded-lg border border-border bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <div className="flex justify-end mt-1">
              <Button
                size="sm"
                onClick={() => handleSaveKey('summaryUserPrompt')}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save User Prompt'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Theme Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sun className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Appearance</h2>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex gap-3">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200',
                  theme === value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border hover:bg-muted/50'
                )}
              >
                <Icon className={cn('h-5 w-5', theme === value ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('text-sm font-medium', theme === value ? 'text-primary' : 'text-muted-foreground')}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">About</h2>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 shadow-sm">
              <Rss className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">KnowFlow</h3>
              <p className="text-xs text-muted-foreground">Version 0.1.0</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Multi-source content aggregation reader with AI-powered insights.
            Subscribe to WeChat public accounts and more, read with AI summaries,
            Q&A, and mind maps.
          </p>
        </div>
      </section>
    </div>
  );
}
