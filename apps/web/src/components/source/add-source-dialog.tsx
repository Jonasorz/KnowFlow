import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchWechat, useSearchTwitter, useCreateSource, useParseWechatBiz } from '@/hooks/use-sources';
import { Search, Plus, Check, Users, Eye, MessageCircle, HelpCircle, Loader2, Twitter } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WechatAccountSearchResult } from '@knowflow/shared';

interface AddSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function extractBiz(input: string): string {
  const trimmed = input.trim();
  // Try parsing as full URL
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const biz = url.searchParams.get('__biz');
      if (biz) return biz;
    }
  } catch (e) {
    // Ignore URL parse error and fall back
  }

  // Regex fallback for in-text matching: __biz=xxx
  const regex = /__biz=([^&"'\s#]+)/;
  const match = trimmed.match(regex);
  if (match) return match[1];

  return trimmed;
}

export function AddSourceDialog({ open, onOpenChange }: AddSourceDialogProps) {
  const [platform, setPlatform] = useState<'wechat' | 'twitter'>('wechat');
  const [activeTab, setActiveTab] = useState<'search' | 'manual'>('search');
  const [query, setQuery] = useState('');
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
  
  // WeChat Manual states
  const [manualName, setManualName] = useState('');
  const [manualBizOrUrl, setManualBizOrUrl] = useState('');
  const [resolvedBizFromBackend, setResolvedBizFromBackend] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualAvatarUrl, setManualAvatarUrl] = useState('');
  const [manualError, setManualError] = useState('');

  // Twitter Manual states
  const [twManualName, setTwManualName] = useState('');
  const [twManualHandle, setTwManualHandle] = useState('');
  const [twManualDescription, setTwManualDescription] = useState('');
  const [twManualAvatarUrl, setTwManualAvatarUrl] = useState('');
  const [twManualError, setTwManualError] = useState('');

  const { data: wechatResults, isLoading: wechatLoading, isError: wechatError } = useSearchWechat(query);
  const { data: twitterResults, isLoading: twitterLoading, isError: twitterError } = useSearchTwitter(query);
  const createSource = useCreateSource();
  const parseWechatBiz = useParseWechatBiz();

  const results = platform === 'wechat' ? wechatResults : twitterResults;
  const isLoading = platform === 'wechat' ? wechatLoading : twitterLoading;
  const isError = platform === 'wechat' ? wechatError : twitterError;

  // Reset search query and errors when platform changes
  useEffect(() => {
    setQuery('');
    setManualError('');
    setTwManualError('');
  }, [platform]);

  // Reset resolved state and errors when input changes
  useEffect(() => {
    setResolvedBizFromBackend('');
    setManualError('');
  }, [manualBizOrUrl]);

  // Trigger backend parsing if input is a URL and has no local biz query param
  useEffect(() => {
    if (platform !== 'wechat') return;
    
    const trimmed = manualBizOrUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      // Check if it already has __biz
      const localBiz = extractBiz(trimmed);
      if (localBiz && localBiz !== trimmed) {
        return; // Already resolved locally
      }

      // Debounce the backend fetch to avoid spamming requests
      const delayDebounceFn = setTimeout(async () => {
        try {
          const res = await parseWechatBiz.mutateAsync(trimmed);
          if (res && res.biz) {
            setResolvedBizFromBackend(res.biz);
          }
        } catch (err) {
          setManualError('无法从该微信链接中提取 Biz ID，请确认链接有效或手动输入 Biz ID。');
        }
      }, 500);

      return () => clearTimeout(delayDebounceFn);
    }
  }, [manualBizOrUrl, platform]);

  const handleSubscribe = async (account: WechatAccountSearchResult) => {
    try {
      await createSource.mutateAsync({
        type: platform,
        name: account.name,
        identifier: account.biz,
        avatarUrl: account.avatar,
        description: account.description,
      });
      setSubscribedIds((prev) => new Set([...prev, account.biz]));
    } catch {
      // Error handled by mutation
    }
  };

  const handleWechatManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');

    if (!manualName.trim()) {
      setManualError('Please enter the WeChat official account name.');
      return;
    }
    if (!manualBizOrUrl.trim()) {
      setManualError('Please enter a Biz ID or paste any article URL.');
      return;
    }

    let biz = extractBiz(manualBizOrUrl);
    const isUrl = manualBizOrUrl.trim().startsWith('http://') || manualBizOrUrl.trim().startsWith('https://');
    
    if (isUrl) {
      if (biz && biz !== manualBizOrUrl.trim()) {
        // use local parsed biz
      } else {
        biz = resolvedBizFromBackend;
      }
    }

    // If still not resolved and it's a URL, attempt one immediate sync fetch
    if (!biz && isUrl) {
      try {
        const res = await parseWechatBiz.mutateAsync(manualBizOrUrl.trim());
        biz = res.biz;
      } catch (err) {
        setManualError('无法解析该链接，请确认链接正确，或手动输入该公众号的 Biz ID。');
        return;
      }
    }

    if (!biz) {
      setManualError('Invalid Biz ID. Please check your input.');
      return;
    }

    try {
      await createSource.mutateAsync({
        type: 'wechat',
        name: manualName.trim(),
        identifier: biz,
        avatarUrl: manualAvatarUrl.trim() || undefined,
        description: manualDescription.trim() || undefined,
      });

      // Clear form
      setManualName('');
      setManualBizOrUrl('');
      setManualDescription('');
      setManualAvatarUrl('');
      setResolvedBizFromBackend('');
      
      // Close dialog
      onOpenChange(false);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Failed to add source');
    }
  };

  const handleTwitterManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwManualError('');

    if (!twManualName.trim()) {
      setTwManualError('订阅源名称不能为空');
      return;
    }
    if (!twManualHandle.trim()) {
      setTwManualError('Twitter 用户名不能为空');
      return;
    }

    let handle = twManualHandle.trim();
    if (handle.startsWith('@')) {
      handle = handle.substring(1);
    }

    try {
      await createSource.mutateAsync({
        type: 'twitter',
        name: twManualName.trim(),
        identifier: handle,
        avatarUrl: twManualAvatarUrl.trim() || undefined,
        description: twManualDescription.trim() || undefined,
      });

      // Clear form
      setTwManualName('');
      setTwManualHandle('');
      setTwManualDescription('');
      setTwManualAvatarUrl('');
      
      // Close dialog
      onOpenChange(false);
    } catch (err) {
      setTwManualError(err instanceof Error ? err.message : '添加 Twitter 订阅源失败');
    }
  };

  const localBiz = extractBiz(manualBizOrUrl);
  const isLocalExtracted = localBiz && localBiz !== manualBizOrUrl.trim();
  const finalBiz = isLocalExtracted ? localBiz : resolvedBizFromBackend || (manualBizOrUrl.trim().startsWith('http') ? '' : manualBizOrUrl.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加订阅源</DialogTitle>
          <DialogDescription>
            从不同的内容源同步精彩文章或推文。
          </DialogDescription>
        </DialogHeader>

        {/* Platform Selector */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted/65 border border-border/50 my-1">
          <button
            onClick={() => {
              setPlatform('wechat');
              setActiveTab('search');
            }}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer',
              platform === 'wechat'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MessageCircle className="h-3.5 w-3.5 text-green-500" />
            微信公众号
          </button>
          <button
            onClick={() => {
              setPlatform('twitter');
              setActiveTab('search');
            }}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer',
              platform === 'twitter'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Twitter className="h-3.5 w-3.5 text-sky-500" />
            X (Twitter)
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-border my-2">
          <button
            onClick={() => setActiveTab('search')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all duration-200 border-b-2 cursor-pointer',
              activeTab === 'search'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            <Search className="h-3.5 w-3.5" />
            搜索订阅
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all duration-200 border-b-2 cursor-pointer',
              activeTab === 'manual'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            手动添加
          </button>
        </div>

        {activeTab === 'search' ? (
          <div className="space-y-4">
            {/* Search Input */}
            <div className="mt-2">
              <Input
                icon={<Search className="h-4 w-4" />}
                placeholder={platform === 'wechat' ? "搜索公众号名称..." : "搜索 Twitter 用户..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>

            {/* Search Results */}
            <div className="max-h-80 overflow-y-auto -mx-1 px-1">
              {isLoading && query.length >= 2 && (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg p-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="mb-1 h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-8 w-20 rounded-lg" />
                    </div>
                  ))}
                </div>
              )}

              {isError && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  搜索失败。请检查设置中的 API Key 配置。
                </div>
              )}

              {!isLoading && results && results.length === 0 && query.length >= 2 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  未找到与 "{query}" 相关的账户
                </div>
              )}

              {results && results.length > 0 && (
                <div className="flex flex-col gap-1">
                  {results.map((account) => {
                    const isSubscribed = subscribedIds.has(account.biz);
                    return (
                      <div
                        key={account.biz}
                        className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
                      >
                        {/* Avatar */}
                        {account.avatar ? (
                          <img
                            src={account.avatar}
                            alt={account.name}
                            className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 ring-1 ring-border">
                            {platform === 'wechat' ? (
                              <MessageCircle className="h-5 w-5 text-primary" />
                            ) : (
                              <Twitter className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate flex items-center gap-1">
                            {account.name}
                            {platform === 'twitter' && (
                              <span className="text-xs text-muted-foreground font-normal font-mono">@{account.biz}</span>
                            )}
                          </div>
                          {account.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {account.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {account.fans !== undefined && (
                              <span className="flex items-center gap-1 font-mono">
                                <Users className="h-3 w-3" />
                                {account.fans.toLocaleString()}
                              </span>
                            )}
                            {platform === 'wechat' && account.avgTopRead !== undefined && (
                              <span className="flex items-center gap-1 font-mono">
                                <Eye className="h-3 w-3" />
                                ~{account.avgTopRead.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Subscribe button */}
                        <Button
                          size="sm"
                          variant={isSubscribed ? 'secondary' : 'default'}
                          onClick={() => !isSubscribed && handleSubscribe(account)}
                          disabled={isSubscribed || createSource.isPending}
                          className="shrink-0"
                        >
                          {isSubscribed ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              已订阅
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" />
                              订阅
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {query.length < 2 && !isLoading && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="h-8 w-8 mb-3 opacity-40" />
                  <p className="text-sm">请输入至少 2 个字符开始搜索</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          platform === 'wechat' ? (
            <form onSubmit={handleWechatManualSubmit} className="space-y-3.5 mt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">公众号名称 *</label>
                <Input
                  placeholder="例如: 腾讯科技"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Biz ID 或公众号文章链接 *</label>
                <div className="relative">
                  <Input
                    placeholder="粘贴公众号文章的链接，或直接输入 Biz ID"
                    value={manualBizOrUrl}
                    onChange={(e) => setManualBizOrUrl(e.target.value)}
                    className={cn(parseWechatBiz.isPending && "pr-9")}
                    required
                  />
                  {parseWechatBiz.isPending && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                {parseWechatBiz.isPending && (
                  <p className="text-[10px] text-primary animate-pulse mt-1">
                    正在从文章链接中获取并解析 Biz ID...
                  </p>
                )}
                {!parseWechatBiz.isPending && finalBiz && (
                  <div className="mt-1.5 p-2 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">解析出的 Biz ID:</span>
                    <span className="font-mono text-primary font-semibold select-all">{finalBiz}</span>
                  </div>
                )}
                {!parseWechatBiz.isPending && !finalBiz && (
                  <div className="flex items-start gap-1 text-[10px] text-muted-foreground leading-normal mt-1">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 mt-0.5" />
                    <p>提示：支持手机复制的短链（如 `mp.weixin.qq.com/s/...`）。粘贴后系统会自动请求并解析其 HTML 以提取 Biz ID 建立订阅。</p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">描述 (可选)</label>
                <Input
                  placeholder="例如: 腾讯官方科技前沿资讯媒体"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">头像链接 (可选)</label>
                <Input
                  placeholder="填写图片 URL 地址"
                  value={manualAvatarUrl}
                  onChange={(e) => setManualAvatarUrl(e.target.value)}
                />
              </div>

              {manualError && (
                <p className="text-xs font-medium text-destructive mt-1">{manualError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border mt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button type="submit" size="sm" disabled={createSource.isPending || parseWechatBiz.isPending}>
                  {createSource.isPending ? '添加中...' : '添加订阅'}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleTwitterManualSubmit} className="space-y-3.5 mt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">用户昵称 *</label>
                <Input
                  placeholder="例如: Elon Musk"
                  value={twManualName}
                  onChange={(e) => setTwManualName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Twitter 用户名 (Handle) *</label>
                <Input
                  placeholder="例如: elonmusk (不需要带 @ 符号)"
                  value={twManualHandle}
                  onChange={(e) => setTwManualHandle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">个人简介 (可选)</label>
                <Input
                  placeholder="例如: Tesla, SpaceX, xAI, Neuralink"
                  value={twManualDescription}
                  onChange={(e) => setTwManualDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">头像链接 (可选)</label>
                <Input
                  placeholder="填写图片 URL 地址"
                  value={twManualAvatarUrl}
                  onChange={(e) => setTwManualAvatarUrl(e.target.value)}
                />
              </div>

              {twManualError && (
                <p className="text-xs font-medium text-destructive mt-1">{twManualError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border mt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button type="submit" size="sm" disabled={createSource.isPending}>
                  {createSource.isPending ? '添加中...' : '添加订阅'}
                </Button>
              </div>
            </form>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
