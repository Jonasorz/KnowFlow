import { useState, useEffect, useMemo } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useSettings, useUpdateSettings, useTestApiKey, useDajialaBalance, useTwitterBalance, useMoonshotBalance, useDeepSeekBalance, useTavilyBalance, useOpenRouterBalance, useDashScopeBalance, useOpenRouterModels } from '@/hooks/use-settings';
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
  Headphones,
  ArrowLeft,
  Github,
  ExternalLink,
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
  const cachedData = useAppStore((s) => s.balances.dajiala);
  const lastUpdatedStr = useAppStore((s) => s.balancesLastUpdated.dajiala);
  const setBalance = useAppStore((s) => s.setBalance);

  const { data: qData, refetch, isFetching, error } = useDajialaBalance(cachedData || undefined);
  const data = qData || cachedData;
  const lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : null;

  const handleQuery = async () => {
    const result = await refetch();
    if (result.isSuccess && result.data) {
      setBalance('dajiala', result.data);
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

function TwitterBalanceQuery() {
  const cachedData = useAppStore((s) => s.balances.twitter);
  const lastUpdatedStr = useAppStore((s) => s.balancesLastUpdated.twitter);
  const setBalance = useAppStore((s) => s.setBalance);

  const { data: qData, refetch, isFetching, error } = useTwitterBalance(cachedData || undefined);
  const data = qData || cachedData;
  const lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : null;

  const handleQuery = async () => {
    const result = await refetch();
    if (result.isSuccess && result.data) {
      setBalance('twitter', result.data);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3.5 flex flex-col gap-2.5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Coins className="h-3.5 w-3.5 text-primary" />
          X (Twitter) API 账户余额
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

      {data && (
        <div className="grid grid-cols-2 gap-4 py-1.5">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">剩余额度 (Credits)</span>
            <span className="text-lg font-bold font-mono text-primary mt-0.5">
              {data.recharge_credits}
            </span>
          </div>
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

function MoonshotBalanceQuery() {
  const cachedData = useAppStore((s) => s.balances.moonshot);
  const lastUpdatedStr = useAppStore((s) => s.balancesLastUpdated.moonshot);
  const setBalance = useAppStore((s) => s.setBalance);

  const { data: qData, refetch, isFetching, error } = useMoonshotBalance(cachedData || undefined);
  const data = qData || cachedData;
  const lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : null;

  const handleQuery = async () => {
    const result = await refetch();
    if (result.isSuccess && result.data) {
      setBalance('moonshot', result.data);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3.5 flex flex-col gap-2.5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Coins className="h-3.5 w-3.5 text-primary" />
          Moonshot (Kimi) 账户余额
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

      {data && (
        <div className="grid grid-cols-3 gap-2 py-1.5">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">可用余额</span>
            <span className="text-sm font-bold font-mono text-primary mt-0.5">
              ¥ {data.available_balance.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">现金余额</span>
            <span className="text-sm font-bold font-mono text-foreground/85 mt-0.5">
              ¥ {data.cash_balance.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">赠送余额</span>
            <span className="text-sm font-bold font-mono text-foreground/85 mt-0.5">
              ¥ {data.voucher_balance.toFixed(2)}
            </span>
          </div>
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

function DeepSeekBalanceQuery() {
  const cachedData = useAppStore((s) => s.balances.deepseek);
  const lastUpdatedStr = useAppStore((s) => s.balancesLastUpdated.deepseek);
  const setBalance = useAppStore((s) => s.setBalance);

  const { data: qData, refetch, isFetching, error } = useDeepSeekBalance(cachedData || undefined);
  const data = qData || cachedData;
  const lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : null;

  const handleQuery = async () => {
    const result = await refetch();
    if (result.isSuccess && result.data) {
      setBalance('deepseek', result.data);
    }
  };

  const balanceInfo = data?.balance_infos?.[0];

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3.5 flex flex-col gap-2.5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Coins className="h-3.5 w-3.5 text-primary" />
          DeepSeek 账户余额
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

      {data && balanceInfo && (
        <div className="grid grid-cols-3 gap-2 py-1.5">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">总余额</span>
            <span className="text-sm font-bold font-mono text-primary mt-0.5">
              {balanceInfo.currency === 'CNY' ? '¥' : '$'} {parseFloat(balanceInfo.total_balance).toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">充值余额</span>
            <span className="text-sm font-bold font-mono text-foreground/85 mt-0.5">
              {balanceInfo.currency === 'CNY' ? '¥' : '$'} {parseFloat(balanceInfo.topped_up_balance).toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">赠送余额</span>
            <span className="text-sm font-bold font-mono text-foreground/85 mt-0.5">
              {balanceInfo.currency === 'CNY' ? '¥' : '$'} {parseFloat(balanceInfo.granted_balance).toFixed(2)}
            </span>
          </div>
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

function TavilyBalanceQuery() {
  const cachedData = useAppStore((s) => s.balances.tavily);
  const lastUpdatedStr = useAppStore((s) => s.balancesLastUpdated.tavily);
  const setBalance = useAppStore((s) => s.setBalance);

  const { data: qData, refetch, isFetching, error } = useTavilyBalance(cachedData || undefined);
  const data = qData || cachedData;
  const lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : null;

  const handleQuery = async () => {
    const result = await refetch();
    if (result.isSuccess && result.data) {
      setBalance('tavily', result.data);
    }
  };

  const accountInfo = data?.account;

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3.5 flex flex-col gap-2.5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Coins className="h-3.5 w-3.5 text-primary" />
          Tavily API 调用额度 (Usage)
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
          正在查询 API 额度...
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive bg-destructive/5 border border-destructive/10 rounded-md p-2">
          查询失败: {error instanceof Error ? error.message : '未知错误'}
        </div>
      )}

      {data && accountInfo && (
        <div className="grid grid-cols-3 gap-2 py-1.5">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">已使用 (Used)</span>
            <span className="text-sm font-bold font-mono text-primary mt-0.5">
              {accountInfo.used} / {accountInfo.total_limit}
            </span>
          </div>
          <div className="flex flex-col col-span-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">当前套餐类型</span>
            <span className="text-sm font-bold text-foreground/85 mt-0.5 uppercase tracking-wide">
              {accountInfo.plan || 'Free'} Plan
            </span>
          </div>
        </div>
      )}

      {lastUpdated && (
        <div className="text-[10px] text-muted-foreground/60 text-right mt-1 font-mono">
          最后更新时间: {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {!data && !isFetching && !error && (
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-muted-foreground">尚未查询额度</span>
          <Button variant="outline" size="sm" onClick={handleQuery} className="text-[11px] h-7 px-2.5">
            立即查询
          </Button>
        </div>
      )}
    </div>
  );
}

function OpenRouterBalanceQuery() {
  const cachedData = useAppStore((s) => s.balances.openrouter);
  const lastUpdatedStr = useAppStore((s) => s.balancesLastUpdated.openrouter);
  const setBalance = useAppStore((s) => s.setBalance);

  const { data: qData, refetch, isFetching, error } = useOpenRouterBalance(cachedData || undefined);
  const data = qData || cachedData;
  const lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : null;

  const handleQuery = async () => {
    const result = await refetch();
    if (result.isSuccess && result.data) {
      setBalance('openrouter', result.data);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3.5 flex flex-col gap-2.5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Coins className="h-3.5 w-3.5 text-primary" />
          OpenRouter 账户限额 & 消费
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
          正在查询 API 账户信息...
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive bg-destructive/5 border border-destructive/10 rounded-md p-2">
          查询失败: {error instanceof Error ? error.message : '未知错误'}
        </div>
      )}

      {data && (() => {
        const accountBalance = (data.total_credits !== null && data.total_credits !== undefined && data.total_usage !== null && data.total_usage !== undefined)
          ? Math.max(0, data.total_credits - data.total_usage)
          : null;

        const keyRemaining = (data.limit !== null && data.limit !== undefined)
          ? Math.max(0, data.limit - data.usage)
          : null;

        return (
          <div className="grid grid-cols-2 gap-4 py-1.5 animate-fade-in">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">密钥名称 (Label)</span>
              <span className="text-xs font-bold text-foreground mt-1">
                {data.label || '默认密钥'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">账户余额 (Account Balance)</span>
              <span className="text-sm font-bold font-mono text-emerald-500 mt-0.5">
                {accountBalance !== null ? `$ ${accountBalance.toFixed(4)}` : '仅管理密钥可用'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">密钥已消费 (Key Usage)</span>
              <span className="text-sm font-bold font-mono text-primary mt-0.5">
                $ {data.usage?.toFixed(4) || '0.0000'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">密钥最高限额 (Key Limit)</span>
              <span className="text-sm font-bold font-mono text-foreground/80 mt-0.5">
                {data.limit ? `$ ${data.limit.toFixed(2)}` : '无限制'}
              </span>
            </div>
            {keyRemaining !== null && (
              <div className="flex flex-col col-span-2 border-t border-border/50 pt-2 mt-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">密钥剩余额度 (Key Balance)</span>
                <span className="text-sm font-bold font-mono text-emerald-500 mt-0.5">
                  $ {keyRemaining.toFixed(4)}
                </span>
              </div>
            )}
            {data.is_free_tier && (
              <div className="col-span-2 mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                  免费层级 (Free Tier)
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {lastUpdated && (
        <div className="text-[10px] text-muted-foreground/60 text-right mt-1 font-mono">
          最后更新时间: {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {!data && !isFetching && !error && (
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-muted-foreground">尚未查询账户额度</span>
          <Button variant="outline" size="sm" onClick={handleQuery} className="text-[11px] h-7 px-2.5">
            立即查询
          </Button>
        </div>
      )}
    </div>
  );
}

function DashScopeBalanceQuery() {
  const cachedData = useAppStore((s) => s.balances.dashscope);
  const lastUpdatedStr = useAppStore((s) => s.balancesLastUpdated.dashscope);
  const setBalance = useAppStore((s) => s.setBalance);

  const { data: qData, refetch, isFetching, error } = useDashScopeBalance(cachedData || undefined);
  const data = qData || cachedData;
  const lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : null;

  const handleQuery = async () => {
    const result = await refetch();
    if (result.isSuccess && result.data) {
      setBalance('dashscope', result.data);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3.5 flex flex-col gap-2.5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Coins className="h-3.5 w-3.5 text-primary" />
          通义听悟 (DashScope) 余额信息
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
          正在获取余额信息...
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive bg-destructive/5 border border-destructive/10 rounded-md p-2">
          获取失败: {error instanceof Error ? error.message : '未知错误'}
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-2 py-1 select-none">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">计费模式</span>
              <span className="text-xs font-bold text-foreground/80 mt-0.5">
                {data.billingType}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">额度余额</span>
              <span className="text-xs font-bold text-emerald-500 mt-0.5">
                {data.balance}
              </span>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-2 mt-1 leading-normal border border-border/50">
            {data.tips}{' '}
            <a
              href={data.consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline font-semibold"
            >
              打开控制台 ↗
            </a>
          </div>
        </div>
      )}

      {lastUpdated && (
        <div className="text-[10px] text-muted-foreground/60 text-right mt-1 font-mono">
          最后更新时间: {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {!data && !isFetching && !error && (
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-muted-foreground">尚未获取余额信息</span>
          <Button variant="outline" size="sm" onClick={handleQuery} className="text-[11px] h-7 px-2.5">
            获取信息
          </Button>
        </div>
      )}
    </div>
  );
}

const aiModels: { value: AIModel; label: string }[] = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  { value: 'kimi-k2.6', label: 'Kimi (K2.6)' },
  { value: 'kimi-8k', label: 'Kimi (8k)' },
  { value: 'kimi-32k', label: 'Kimi (32k)' },
];

export function SettingsPage() {
  const router = useRouter();
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { theme, setTheme } = useAppStore();
  const { data: openRouterModels } = useOpenRouterModels();
  const [modelSearch, setModelSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<'deepseek' | 'moonshot' | 'openrouter'>('deepseek');

  const [formState, setFormState] = useState<Partial<Settings>>({});
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'llm' | 'prompts-general' | 'prompts-podcast' | 'general'>('subscriptions');

  useEffect(() => {
    if (settings) {
      setFormState(settings);

      // Auto-detect provider based on current default model
      const currentModel = settings.defaultAIModel || 'deepseek-chat';
      if (currentModel.startsWith('openrouter/')) {
        setSelectedProvider('openrouter');
      } else if (currentModel.startsWith('kimi-')) {
        setSelectedProvider('moonshot');
      } else {
        setSelectedProvider('deepseek');
      }
    }
  }, [settings]);

  const settingsTabs = [
    { id: 'subscriptions' as const, label: '订阅源 API', icon: <Rss className="h-4 w-4" /> },
    { id: 'llm' as const, label: 'AI LLM API', icon: <Key className="h-4 w-4" /> },
    { id: 'prompts-general' as const, label: '通用总结提示词', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'prompts-podcast' as const, label: '播客总结提示词', icon: <Headphones className="h-4 w-4" /> },
    { id: 'general' as const, label: '常规设置', icon: <Monitor className="h-4 w-4" /> },
  ];

  const providerModels = useMemo(() => {
    if (selectedProvider === 'deepseek') {
      return [
        { value: 'deepseek-chat', label: 'DeepSeek Chat' },
        { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
      ];
    } else if (selectedProvider === 'moonshot') {
      return [
        { value: 'kimi-k2.6', label: 'Kimi (K2.6)' },
        { value: 'kimi-8k', label: 'Kimi (8k)' },
        { value: 'kimi-32k', label: 'Kimi (32k)' },
      ];
    } else {
      const list: { value: string; label: string }[] = [];
      if (openRouterModels && Array.isArray(openRouterModels)) {
        openRouterModels.forEach((m: any) => {
          list.push({
            value: `openrouter/${m.id}`,
            label: m.name || m.id,
          });
        });
      }
      return list;
    }
  }, [selectedProvider, openRouterModels]);

  const filteredProviderModels = useMemo(() => {
    return providerModels.filter((m) =>
      m.label.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.value.toLowerCase().includes(modelSearch.toLowerCase())
    );
  }, [providerModels, modelSearch]);

  const currentModelLabel = useMemo(() => {
    const currentVal = formState.defaultAIModel || 'deepseek-chat';
    const staticModels = [
      { value: 'deepseek-chat', label: 'DeepSeek Chat' },
      { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
      { value: 'kimi-k2.6', label: 'Kimi (K2.6)' },
      { value: 'kimi-8k', label: 'Kimi (8k)' },
      { value: 'kimi-32k', label: 'Kimi (32k)' },
    ];
    const foundStatic = staticModels.find((m) => m.value === currentVal);
    if (foundStatic) return foundStatic.label;

    if (currentVal.startsWith('openrouter/') && openRouterModels && Array.isArray(openRouterModels)) {
      const modelId = currentVal.replace('openrouter/', '');
      const foundOR = openRouterModels.find((m: any) => m.id === modelId);
      if (foundOR) return `OpenRouter: ${foundOR.name || foundOR.id}`;
    }
    return currentVal;
  }, [formState.defaultAIModel, openRouterModels]);

  const handleSaveKey = (key: keyof Settings) => {
    updateSettings.mutate({ [key]: formState[key] });
  };

  const handleSelectProvider = (p: 'deepseek' | 'moonshot' | 'openrouter') => {
    setSelectedProvider(p);
    setModelSearch('');

    let defaultModel = 'deepseek-chat';
    if (p === 'moonshot') {
      defaultModel = 'kimi-k2.6';
    } else if (p === 'openrouter') {
      if (openRouterModels && openRouterModels.length > 0) {
        defaultModel = `openrouter/${openRouterModels[0].id}`;
      } else {
        defaultModel = 'openrouter/google/gemini-2.5-flash';
      }
    }

    setFormState((s) => ({ ...s, defaultAIModel: defaultModel }));
    updateSettings.mutate({ defaultAIModel: defaultModel });
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
      <div className="flex items-center gap-3 mb-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.history.back()}
          className="shrink-0 -ml-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 ml-9">
        Configure your API keys, AI model preferences, and appearance.
      </p>

      {/* Tab Selector */}
      <div className="flex border-b border-border mb-6 overflow-x-auto select-none no-scrollbar">
        {settingsTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 border-b-2 font-medium text-xs transition-colors shrink-0 outline-none cursor-pointer',
                isActive
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'subscriptions' && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Rss className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">订阅源 API 密钥</h2>
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
              >
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  使用 twitterapi.io 获取 X/Twitter 用户资料与推文。可在{' '}
                  <a
                    href="https://twitterapi.io/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    twitterapi.io
                  </a>{' '}
                  申请 API Key。
                </p>
                {settings?.twitterApiKey && (
                  <TwitterBalanceQuery />
                )}
              </ApiKeyField>
            </div>
          </section>
        )}

        {activeTab === 'llm' && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">启用与模型配置</h2>
            </div>

            {/* Hint Alert */}
            <div className="flex gap-2.5 p-3.5 bg-primary/5 border border-primary/10 rounded-xl text-xs text-muted-foreground leading-normal select-none mb-4 animate-fade-in">
              <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <div>
                <span className="font-semibold text-foreground/90">使用说明：</span>
                DeepSeek、Moonshot (Kimi)、OpenRouter 三个 API 服务商<strong>只要填其中一个</strong>的密钥即可正常工作。系统已将各服务商的模型列表进行隔离，请显式选择您要启用的服务商与默认模型，并在下方配置相应的密钥。
              </div>
            </div>

            {/* Model and Active Provider Selector Box */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-6 animate-fade-in">
              {/* Provider Radio Selector */}
              <div className="flex flex-col gap-2.5">
                <label className="text-sm font-medium">选择要启用的服务商</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['deepseek', 'moonshot', 'openrouter'] as const).map((p) => {
                    const isActive = selectedProvider === p;
                    const label = p === 'deepseek' ? 'DeepSeek' : p === 'moonshot' ? 'Moonshot (Kimi)' : 'OpenRouter';
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleSelectProvider(p)}
                        className={cn(
                          'flex items-center justify-between px-4 py-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer outline-none select-none text-left',
                          isActive
                            ? 'border-primary bg-primary/5 text-primary shadow-sm'
                            : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'h-4 w-4 rounded-full border flex items-center justify-center transition-colors shrink-0',
                            isActive ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                          )}>
                            {isActive && <div className="h-1.5 w-1.5 rounded-full bg-background" />}
                          </div>
                          <span className="font-medium text-foreground">{label}</span>
                        </div>
                        {isActive && (
                          <Badge variant="success" className="text-[10px] py-0 px-1.5 font-medium h-5 shrink-0">
                            已启用
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Model Dropdown */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">默认 AI 模型</label>
                  {!formState[`${selectedProvider}ApiKey` as keyof Settings] && (
                    <span className="text-[10px] text-amber-500 font-medium select-none">
                      ⚠️ 提示：请先配置并保存下方 {selectedProvider === 'deepseek' ? 'DeepSeek' : selectedProvider === 'moonshot' ? 'Moonshot' : 'OpenRouter'} 的密钥
                    </span>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="outline" className="w-full justify-between">
                      {currentModelLabel}
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-full min-w-[280px] max-h-[350px] overflow-y-auto">
                    <DropdownMenuLabel className="pb-1 text-xs">
                      选择默认模型 ({selectedProvider === 'deepseek' ? 'DeepSeek' : selectedProvider === 'moonshot' ? 'Kimi' : 'OpenRouter'})
                    </DropdownMenuLabel>
                    <div className="px-2 pb-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        placeholder="搜索模型..."
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <DropdownMenuSeparator />
                    {filteredProviderModels.map((model) => (
                      <DropdownMenuItem
                        key={model.value}
                        onClick={() => {
                          setFormState((s) => ({ ...s, defaultAIModel: model.value }));
                          updateSettings.mutate({ defaultAIModel: model.value });
                        }}
                      >
                        <span className="flex-1 text-xs">{model.label}</span>
                        {formState.defaultAIModel === model.value && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                    {filteredProviderModels.length === 0 && (
                      <div className="text-[11px] text-muted-foreground text-center py-4 animate-pulse">
                        未找到匹配的模型
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6 mb-1">
              <Key className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">服务商密钥配置</h2>
            </div>

            {/* API Keys Configuration Box */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-5 animate-fade-in">
              <ApiKeyField
                label="DeepSeek API Key"
                provider="deepseek"
                value={formState.deepseekApiKey || ''}
                onChange={(v) => setFormState((s) => ({ ...s, deepseekApiKey: v }))}
                onSave={() => handleSaveKey('deepseekApiKey')}
                saving={updateSettings.isPending}
              >
                {settings?.deepseekApiKey && (
                  <DeepSeekBalanceQuery />
                )}
              </ApiKeyField>

              <Separator />

              <ApiKeyField
                label="Moonshot (Kimi) API Key"
                provider="moonshot"
                value={formState.moonshotApiKey || ''}
                onChange={(v) => setFormState((s) => ({ ...s, moonshotApiKey: v }))}
                onSave={() => handleSaveKey('moonshotApiKey')}
                saving={updateSettings.isPending}
              >
                {settings?.moonshotApiKey && (
                  <MoonshotBalanceQuery />
                )}
              </ApiKeyField>

              <Separator />

              <ApiKeyField
                label="OpenRouter API Key"
                provider="openrouter"
                value={formState.openrouterApiKey || ''}
                onChange={(v) => setFormState((s) => ({ ...s, openrouterApiKey: v }))}
                onSave={() => handleSaveKey('openrouterApiKey')}
                saving={updateSettings.isPending}
              >
                {settings?.openrouterApiKey && (
                  <OpenRouterBalanceQuery />
                )}
              </ApiKeyField>
            </div>

            {/* Other keys section */}
            <div className="flex items-center gap-2 mt-6 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">附加配置 API 密钥</h2>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-5">
              <ApiKeyField
                label="Tavily Search API Key (可选)"
                provider="tavily"
                value={formState.tavilyApiKey || ''}
                onChange={(v) => setFormState((s) => ({ ...s, tavilyApiKey: v }))}
                onSave={() => handleSaveKey('tavilyApiKey')}
                saving={updateSettings.isPending}
              >
                <p className="text-xs text-muted-foreground mt-1 select-none leading-normal">
                  提示：Tavily API 用于 AI 问答时的实时联网搜索。若不配置，AI 问答功能依然可用，但将仅基于文章本身的内容进行回答。
                </p>
                {settings?.tavilyApiKey && (
                  <TavilyBalanceQuery />
                )}
              </ApiKeyField>
              <Separator />
              <ApiKeyField
                label="通义听悟 (DashScope) API Key (可选)"
                provider="dashscope"
                value={formState.dashscopeApiKey || ''}
                onChange={(v) => setFormState((s) => ({ ...s, dashscopeApiKey: v }))}
                onSave={() => handleSaveKey('dashscopeApiKey')}
                saving={updateSettings.isPending}
              >
                <p className="text-xs text-muted-foreground mt-1 select-none leading-normal">
                  提示：通义听悟 API 主要用于播客音频的语音转写与发言人角色识别（播客专用，非必填）。
                </p>
                {settings?.dashscopeApiKey && (
                  <DashScopeBalanceQuery />
                )}
              </ApiKeyField>
            </div>
          </section>
        )}

        {activeTab === 'prompts-general' && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">通用总结提示词设置</h2>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">System Prompt (系统提示词)</label>
                <textarea
                  value={formState.summarySystemPrompt || ''}
                  onChange={(e) => setFormState((s) => ({ ...s, summarySystemPrompt: e.target.value }))}
                  placeholder="Enter AI system prompt..."
                  className="w-full min-h-[160px] text-xs font-mono p-3 rounded-lg border border-border bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
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
                  className="w-full min-h-[100px] text-xs font-mono p-3 rounded-lg border border-border bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
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
        )}

        {activeTab === 'prompts-podcast' && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Headphones className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">播客总结提示词设置</h2>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Podcast System Prompt (播客系统提示词)</label>
                <textarea
                  value={formState.podcastSummarySystemPrompt || ''}
                  onChange={(e) => setFormState((s) => ({ ...s, podcastSummarySystemPrompt: e.target.value }))}
                  placeholder="Enter podcast AI system prompt..."
                  className="w-full min-h-[220px] text-xs font-mono p-3 rounded-lg border border-border bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
                />
                <div className="flex justify-end mt-1">
                  <Button
                    size="sm"
                    onClick={() => handleSaveKey('podcastSummarySystemPrompt')}
                    disabled={updateSettings.isPending}
                  >
                    {updateSettings.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Podcast System Prompt'}
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Podcast User Prompt Template (播客用户提示词模板)</label>
                  <span className="text-[10px] text-muted-foreground font-mono">Use {'{{content}}'} as placeholder</span>
                </div>
                <textarea
                  value={formState.podcastSummaryUserPrompt || ''}
                  onChange={(e) => setFormState((s) => ({ ...s, podcastSummaryUserPrompt: e.target.value }))}
                  placeholder="Enter podcast user prompt template..."
                  className="w-full min-h-[100px] text-xs font-mono p-3 rounded-lg border border-border bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
                />
                <div className="flex justify-end mt-1">
                  <Button
                    size="sm"
                    onClick={() => handleSaveKey('podcastSummaryUserPrompt')}
                    disabled={updateSettings.isPending}
                  >
                    {updateSettings.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Podcast User Prompt'}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'general' && (
          <section className="space-y-6">
            {/* Theme Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
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
                        'flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer',
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
            </div>

            {/* About Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
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
                    <p className="text-xs text-muted-foreground">Version {__APP_VERSION__}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Multi-source content aggregation reader with AI-powered insights.
                  Subscribe to WeChat public accounts and more, read with AI summaries,
                  Q&A, and mind maps.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://github.com/Jonasorz/KnowFlow', '_blank', 'noopener,noreferrer')}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Github className="h-3.5 w-3.5" />
                    GitHub
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
