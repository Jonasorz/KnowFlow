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
import { useSearchWechat, useSearchTwitter, useSearchPodcast, useCreateSource, useParseWechatBiz, useBulkImportSources } from '@/hooks/use-sources';
import { Search, Plus, Check, Users, Eye, MessageCircle, HelpCircle, Loader2, Twitter, Upload, FileText, Trash2, Headphones, Download } from 'lucide-react';
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

function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let col = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          col += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        col += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(col);
        col = '';
      } else if (char === '\n' || char === '\r') {
        row.push(col);
        col = '';
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
          result.push(row);
        }
        row = [];
        if (char === '\r' && next === '\n') {
          i++; // Skip \n
        }
      } else {
        col += char;
      }
    }
  }
  if (col !== '' || row.length > 0) {
    row.push(col);
    result.push(row);
  }
  return result;
}

function parsePodcastOPML(text: string): Array<{ name: string; identifier: string; description?: string; avatarUrl?: string }> {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('OPML/XML 文件格式不正确');
  }

  return Array.from(doc.querySelectorAll('outline'))
    .map((node) => {
      const identifier = node.getAttribute('xmlUrl') || node.getAttribute('xmlurl') || '';
      const name = node.getAttribute('title') || node.getAttribute('text') || identifier;
      const description = node.getAttribute('description') || node.getAttribute('htmlUrl') || node.getAttribute('htmlurl') || '';
      return {
        name: name.trim(),
        identifier: identifier.trim(),
        description: description.trim(),
      };
    })
    .filter((item) => item.identifier.startsWith('http'));
}

function normalizeTwitterHandle(input: string): string {
  let handle = input.trim();
  if (handle.startsWith('https://x.com/') || handle.startsWith('https://twitter.com/')) {
    const url = new URL(handle);
    handle = url.pathname.split('/').filter(Boolean)[0] || '';
  }
  if (handle.startsWith('@')) {
    handle = handle.substring(1);
  }
  return handle.split('?')[0].replace(/['"]/g, '').trim();
}

function downloadTwitterCsvTemplate() {
  const rows = [
    ['Username', 'Name', 'Bio', 'Avatar'],
    ['elonmusk', 'Elon Musk', 'Tesla, SpaceX, xAI', 'https://example.com/avatar.jpg'],
    ['@OpenAI', 'OpenAI', 'AI research and products', ''],
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'knowflow-twitter-import-template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AddSourceDialog({ open, onOpenChange }: AddSourceDialogProps) {
  const [platform, setPlatform] = useState<'wechat' | 'twitter' | 'podcast'>('wechat');
  const [activeTab, setActiveTab] = useState<'search' | 'manual' | 'bulk'>('search');
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

  // Podcast Manual states
  const [podcastManualName, setPodcastManualName] = useState('');
  const [podcastManualFeedUrl, setPodcastManualFeedUrl] = useState('');
  const [podcastManualDescription, setPodcastManualDescription] = useState('');
  const [podcastManualAvatarUrl, setPodcastManualAvatarUrl] = useState('');
  const [podcastManualError, setPodcastManualError] = useState('');

  // Twitter Bulk states
  const [bulkInput, setBulkInput] = useState('');
  const [bulkImportResults, setBulkImportResults] = useState<Array<{ identifier: string; success: boolean; error?: string }> | null>(null);
  const [bulkError, setBulkError] = useState('');
  const [bulkMode, setBulkMode] = useState<'file' | 'text'>('file');
  const [fileName, setFileName] = useState('');
  const [parsedSources, setParsedSources] = useState<Array<{ name: string; identifier: string; description?: string; avatarUrl?: string }>>([]);

  const { data: wechatResults, isLoading: wechatLoading, isError: wechatError } = useSearchWechat(query, platform === 'wechat');
  const { data: twitterResults, isLoading: twitterLoading, isError: twitterError } = useSearchTwitter(query, platform === 'twitter');
  const { data: podcastResults, isLoading: podcastLoading, isError: podcastError } = useSearchPodcast(query, platform === 'podcast');
  const createSource = useCreateSource();
  const parseWechatBiz = useParseWechatBiz();
  const bulkImport = useBulkImportSources();

  const results = platform === 'wechat' ? wechatResults : platform === 'twitter' ? twitterResults : podcastResults;
  const isLoading = platform === 'wechat' ? wechatLoading : platform === 'twitter' ? twitterLoading : podcastLoading;
  const isError = platform === 'wechat' ? wechatError : platform === 'twitter' ? twitterError : podcastError;

  // Reset search query and errors when platform changes
  useEffect(() => {
    setQuery('');
    setManualError('');
    setTwManualError('');
    setPodcastManualError('');
    if (platform === 'wechat') {
      setActiveTab('manual');
    } else {
      setActiveTab('search');
    }
  }, [platform]);

  // Reset bulk import states when platform, tab, or dialog state changes
  useEffect(() => {
    setBulkInput('');
    setBulkImportResults(null);
    setBulkError('');
    setBulkMode('file');
    setFileName('');
    setParsedSources([]);
  }, [platform, activeTab, open]);

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
            if (res.name) {
              setManualName(res.name);
            }
            if (res.avatarUrl) {
              setManualAvatarUrl(res.avatarUrl);
            }
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
        if (res.name) {
          setManualName(res.name);
        }
        if (res.avatarUrl) {
          setManualAvatarUrl(res.avatarUrl);
        }
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

  const handlePodcastManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPodcastManualError('');

    if (!podcastManualName.trim()) {
      setPodcastManualError('订阅源名称不能为空');
      return;
    }
    if (!podcastManualFeedUrl.trim()) {
      setPodcastManualError('RSS 订阅源地址不能为空');
      return;
    }

    try {
      await createSource.mutateAsync({
        type: 'podcast',
        name: podcastManualName.trim(),
        identifier: podcastManualFeedUrl.trim(),
        avatarUrl: podcastManualAvatarUrl.trim() || undefined,
        description: podcastManualDescription.trim() || undefined,
      });

      // Clear form
      setPodcastManualName('');
      setPodcastManualFeedUrl('');
      setPodcastManualDescription('');
      setPodcastManualAvatarUrl('');
      
      // Close dialog
      onOpenChange(false);
    } catch (err) {
      setPodcastManualError(err instanceof Error ? err.message : '添加播客订阅源失败');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setBulkError('');
    setParsedSources([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          setBulkError('文件内容为空');
          return;
        }

        if (platform === 'podcast') {
          const sources = parsePodcastOPML(text);
          if (sources.length === 0) {
            setBulkError('未在 OPML 文件中解析到有效的播客 RSS 地址');
            return;
          }
          setParsedSources(sources);
          return;
        }

        const parsedRows = parseCSV(text);
        if (parsedRows.length < 2) {
          setBulkError('CSV 文件格式不正确或没有数据');
          return;
        }

        const headers = parsedRows[0].map(h => h.trim().toLowerCase());
        
        // Find username column
        const usernameCandidates = ['username', 'user_name', 'user name', 'handle', 'screen_name', 'screen name', 'identifier'];
        let usernameIndex = -1;
        for (const candidate of usernameCandidates) {
          const idx = headers.indexOf(candidate);
          if (idx !== -1) {
            usernameIndex = idx;
            break;
          }
        }

        // Find name column
        const nameCandidates = ['name', 'display_name', 'display name', 'title'];
        let nameIndex = -1;
        for (const candidate of nameCandidates) {
          const idx = headers.indexOf(candidate);
          if (idx !== -1) {
            nameIndex = idx;
            break;
          }
        }

        // Find bio column
        const bioCandidates = ['bio', 'description', 'about', 'summary', 'profile_bio'];
        let bioIndex = -1;
        for (const candidate of bioCandidates) {
          const idx = headers.indexOf(candidate);
          if (idx !== -1) {
            bioIndex = idx;
            break;
          }
        }

        // Find avatar column
        const avatarCandidates = ['avatar_url', 'avatarurl', 'avatar', 'profile_image_url', 'profile image url', 'profile_picture', 'profile picture'];
        let avatarIndex = -1;
        for (const candidate of avatarCandidates) {
          const idx = headers.indexOf(candidate);
          if (idx !== -1) {
            avatarIndex = idx;
            break;
          }
        }

        if (usernameIndex === -1) {
          setBulkError('CSV 文件缺少 "Username" 或 "user_name" 列（用户名）');
          return;
        }

        const sources = parsedRows.slice(1).map(row => {
          const identifier = normalizeTwitterHandle(row[usernameIndex] || '');

          const name = nameIndex !== -1 ? row[nameIndex]?.trim() || identifier : identifier;
          const description = bioIndex !== -1 ? row[bioIndex]?.trim() || '' : '';
          const avatarUrl = avatarIndex !== -1 ? row[avatarIndex]?.trim() || '' : '';

          return { identifier, name, description, avatarUrl };
        }).filter(s => s.identifier.length > 0);

        if (sources.length === 0) {
          setBulkError('未解析到任何有效的 Twitter 用户名');
          return;
        }

        setParsedSources(sources);
      } catch (err) {
        setBulkError('解析 CSV 文件失败：' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  };

  const handleTwitterBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError('');
    setBulkImportResults(null);

    if (bulkMode === 'file') {
      if (parsedSources.length === 0) {
        setBulkError('请先选择有效的 CSV 导入文件');
        return;
      }

      try {
        const res = await bulkImport.mutateAsync({
          type: 'twitter',
          sources: parsedSources,
        });
        setBulkImportResults(res);
      } catch (err) {
        setBulkError(err instanceof Error ? err.message : '批量导入失败');
      }
    } else {
      const input = bulkInput.trim();
      if (!input) {
        setBulkError('请输入要导入的 Twitter 用户名');
        return;
      }

      // Parse input: split by comma, space, or newline
      const identifiers = input
        .split(/[\s,;\n]+/)
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
        .map(normalizeTwitterHandle)
        .filter((id) => id.length > 0);

      if (identifiers.length === 0) {
        setBulkError('未能提取到有效的 Twitter 用户名');
        return;
      }

      try {
        const res = await bulkImport.mutateAsync({
          type: 'twitter',
          identifiers,
        });
        setBulkImportResults(res);
        setBulkInput('');
      } catch (err) {
        setBulkError(err instanceof Error ? err.message : '批量导入失败');
      }
    }
  };

  const handlePodcastBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError('');
    setBulkImportResults(null);

    if (parsedSources.length === 0) {
      setBulkError('请先选择有效的 OPML 文件');
      return;
    }

    const results: Array<{ identifier: string; success: boolean; error?: string }> = [];
    for (const source of parsedSources) {
      try {
        await createSource.mutateAsync({
          type: 'podcast',
          name: source.name,
          identifier: source.identifier,
          description: source.description,
        });
        results.push({ identifier: source.name || source.identifier, success: true });
      } catch (err) {
        results.push({
          identifier: source.name || source.identifier,
          success: false,
          error: err instanceof Error ? err.message : '导入失败',
        });
      }
    }
    setBulkImportResults(results);
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
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/65 border border-border/50 my-1">
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
          <button
            onClick={() => {
              setPlatform('podcast');
              setActiveTab('search');
            }}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer',
              platform === 'podcast'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Headphones className="h-3.5 w-3.5 text-red-500" />
            播客频道
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-border my-2">
          {platform !== 'wechat' && (
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
          )}
          <button
            onClick={() => setActiveTab('manual')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all duration-200 border-b-2 cursor-pointer',
              activeTab === 'manual' || (platform === 'wechat' && activeTab === 'search')
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            手动添加
          </button>
          {(platform === 'twitter' || platform === 'podcast') && (
            <button
              onClick={() => setActiveTab('bulk')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all duration-200 border-b-2 cursor-pointer',
                activeTab === 'bulk'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {platform === 'podcast' ? <Upload className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
              {platform === 'podcast' ? 'OPML 导入' : '批量导入'}
            </button>
          )}
        </div>

        {activeTab === 'search' && (
          <div className="space-y-4">
            {/* Search Input */}
            <div className="mt-2">
              <Input
                icon={<Search className="h-4 w-4" />}
                placeholder={platform === 'wechat' ? "搜索公众号名称..." : platform === 'twitter' ? "搜索 Twitter 用户..." : "搜索播客名称 (调用 iTunes)..."}
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
                            ) : platform === 'twitter' ? (
                              <Twitter className="h-5 w-5 text-primary" />
                            ) : (
                              <Headphones className="h-5 w-5 text-primary" />
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
        )}

        {activeTab === 'manual' && (
          platform === 'wechat' ? (
            <form onSubmit={handleWechatManualSubmit} className="space-y-3.5 mt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">微信文章链接 或 Biz ID *</label>
                <div className="relative">
                  <Input
                    placeholder="粘贴微信公众号的任意文章链接，或直接输入 Biz ID"
                    value={manualBizOrUrl}
                    onChange={(e) => setManualBizOrUrl(e.target.value)}
                    className={cn(parseWechatBiz.isPending && "pr-9")}
                    required
                    autoFocus
                  />
                  {parseWechatBiz.isPending && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                {parseWechatBiz.isPending && (
                  <p className="text-[10px] text-primary animate-pulse mt-1">
                    正在从文章链接中解析 Biz ID、公众号名称及头像...
                  </p>
                )}
                {!parseWechatBiz.isPending && finalBiz && (
                  <div className="mt-1.5 p-2.5 rounded-xl bg-primary/5 border border-primary/10 flex flex-col gap-1 text-[11px] animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Biz ID:</span>
                      <span className="font-mono text-primary font-semibold select-all">{finalBiz}</span>
                    </div>
                    {manualName && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">公众号名称:</span>
                        <span className="text-foreground font-semibold">{manualName}</span>
                      </div>
                    )}
                  </div>
                )}
                {!parseWechatBiz.isPending && !finalBiz && (
                  <div className="flex items-start gap-1 text-[10px] text-muted-foreground leading-normal mt-1">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 mt-0.5" />
                    <p>提示：支持复制公众号任意文章的链接粘贴到此处。系统将全自动提取 Biz ID、名字及头像，实现一键极速订阅，完全免费。</p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">公众号名称 * (自动解析填充)</label>
                <Input
                  placeholder="例如: 腾讯科技"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  required
                />
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
                <label className="text-xs font-semibold text-foreground">头像链接 (可选) (自动解析填充)</label>
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
          ) : platform === 'twitter' ? (
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
          ) : (
            <form onSubmit={handlePodcastManualSubmit} className="space-y-3.5 mt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">播客频道名称 *</label>
                <Input
                  placeholder="例如: 忽左忽右"
                  value={podcastManualName}
                  onChange={(e) => setPodcastManualName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">RSS 订阅源地址 (Feed URL) *</label>
                <Input
                  placeholder="例如: https://feed.justpod.fm/leftright"
                  value={podcastManualFeedUrl}
                  onChange={(e) => setPodcastManualFeedUrl(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">播客简介 (可选)</label>
                <Input
                  placeholder="例如: 程衍樑和沙青青主持的文化沙龙播客"
                  value={podcastManualDescription}
                  onChange={(e) => setPodcastManualDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">封面图片链接 (可选)</label>
                <Input
                  placeholder="填写图片 URL 地址"
                  value={podcastManualAvatarUrl}
                  onChange={(e) => setPodcastManualAvatarUrl(e.target.value)}
                />
              </div>

              {podcastManualError && (
                <p className="text-xs font-medium text-destructive mt-1">{podcastManualError}</p>
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

        {activeTab === 'bulk' && (
          <div className="space-y-4">
            {bulkImportResults ? (
              <div className="space-y-3 mt-2">
                <div className="text-xs font-semibold text-muted-foreground flex justify-between items-center">
                  <span>导入结果 ({bulkImportResults.filter(r => r.success).length} 成功, {bulkImportResults.filter(r => !r.success).length} 失败)</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => {
                      setBulkImportResults(null);
                      setFileName('');
                      setParsedSources([]);
                      setBulkInput('');
                    }}
                  >
                    继续导入
                  </Button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5 border border-border rounded-xl p-3 bg-muted/20">
                  {bulkImportResults.map((res, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1">
                      <span className="font-mono font-semibold">{platform === 'podcast' ? res.identifier : `@${res.identifier}`}</span>
                      {res.success ? (
                        <span className="text-green-600 flex items-center gap-1 font-medium">
                          <Check className="h-3.5 w-3.5" /> 导入成功
                        </span>
                      ) : (
                        <span className="text-destructive font-medium flex items-center gap-1" title={res.error}>
                          失败: {res.error || '重名或API错误'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={() => onOpenChange(false)}>
                    完成
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={platform === 'podcast' ? handlePodcastBulkSubmit : handleTwitterBulkSubmit} className="space-y-3.5 mt-2">
                {/* Bulk Import Mode Selector */}
                {platform === 'twitter' && (
                  <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded-lg bg-muted/65 border border-border/40 text-[11px] mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkMode('file');
                      setBulkError('');
                      setParsedSources([]);
                    }}
                    className={cn(
                      "py-1.5 rounded-md font-semibold transition-all duration-200 cursor-pointer text-center",
                      bulkMode === 'file'
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    CSV 文件导入
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkMode('text');
                      setBulkError('');
                      setParsedSources([]);
                    }}
                    className={cn(
                      "py-1.5 rounded-md font-semibold transition-all duration-200 cursor-pointer text-center",
                      bulkMode === 'text'
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    文本批量粘贴
                  </button>
                  </div>
                )}

                {parsedSources.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/10">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="h-5 w-5 text-sky-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-foreground">{fileName}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            解析成功，共 {parsedSources.length} 个待导入{platform === 'podcast' ? '播客订阅源' : '用户'}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        onClick={() => {
                          setFileName('');
                          setParsedSources([]);
                          setBulkError('');
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Preview section */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground">导入预览 (前 5 个):</p>
                      <div className="border border-border/80 rounded-xl divide-y divide-border/60 bg-card overflow-hidden">
                        {parsedSources.slice(0, 5).map((src, i) => (
                          <div key={i} className="p-2.5 flex flex-col gap-0.5 text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              {src.avatarUrl ? (
                                <img
                                  src={src.avatarUrl}
                                  alt={src.name}
                                  className="h-5 w-5 rounded-full object-cover ring-1 ring-border shrink-0"
                                />
                              ) : (
                                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  {platform === 'podcast' ? <Headphones className="h-3 w-3 text-primary" /> : <Twitter className="h-3 w-3 text-primary" />}
                                </div>
                              )}
                              <span>{src.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground font-normal">
                                {platform === 'podcast' ? src.identifier : `@${src.identifier}`}
                              </span>
                            </div>
                            {src.description && (
                              <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5 leading-normal">{src.description}</p>
                            )}
                          </div>
                        ))}
                        {parsedSources.length > 5 && (
                          <div className="p-2 text-center text-[10px] text-muted-foreground bg-muted/5 border-t border-border/60">
                            ... 还有 {parsedSources.length - 5} 个{platform === 'podcast' ? '订阅源' : '账户'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : platform === 'podcast' || bulkMode === 'file' ? (
                  <div className="space-y-3">
                    {platform === 'twitter' && (
                      <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-[11px] text-muted-foreground leading-relaxed">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="font-semibold text-foreground">CSV 格式说明</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={downloadTwitterCsvTemplate}
                            className="h-7 shrink-0 gap-1.5 px-2 text-[11px]"
                          >
                            <Download className="h-3.5 w-3.5" />
                            下载模板
                          </Button>
                        </div>
                        <div className="space-y-1">
                          <p><span className="font-semibold text-foreground">必填列：</span><span className="font-mono">Username</span>，可填写 <span className="font-mono">elonmusk</span>、<span className="font-mono">@OpenAI</span> 或个人主页 URL。</p>
                          <p><span className="font-semibold text-foreground">可选列：</span><span className="font-mono">Name</span>、<span className="font-mono">Bio</span>/<span className="font-mono">Description</span>、<span className="font-mono">Avatar</span>。</p>
                          <p><span className="font-semibold text-foreground">表头示例：</span><span className="font-mono">Username,Name,Bio,Avatar</span></p>
                        </div>
                      </div>
                    )}
                    <div className="border border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-muted/5 hover:bg-muted/10 transition-colors cursor-pointer relative group">
                      <input
                        type="file"
                        accept={platform === 'podcast' ? '.opml,.xml' : '.csv'}
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <div className="p-3 rounded-full bg-primary/5 text-primary group-hover:scale-105 transition-transform duration-200">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-foreground">
                          {platform === 'podcast' ? '选择或拖拽 OPML 文件上传' : '选择或拖拽 CSV 文件上传'}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {platform === 'podcast'
                            ? '支持小宇宙等播客应用导出的 OPML 订阅列表'
                            : '支持 Username、Name、Bio/Description、Avatar 列'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">X (Twitter) 用户名列表</label>
                    <textarea
                      placeholder="输入要导入的用户名，支持用逗号、空格或换行分隔。例如：&#10;elonmusk, @OpenAI, dynamic_devs&#10;@anthropic_ai"
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      className="w-full h-32 text-xs font-mono p-3 rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary leading-normal resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      提示：文本模式支持 @handle、handle、个人主页 URL，用逗号、空格或换行分隔。CSV 模式支持 Chrome 插件或其它工具导出的关注列表，常见列名包括 Username、Name、Bio/Description、Avatar。
                    </p>
                  </div>
                )}

                {bulkError && (
                  <p className="text-xs font-medium text-destructive mt-1">{bulkError}</p>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-border mt-4">
                  <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    取消
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={bulkImport.isPending || createSource.isPending || ((platform === 'podcast' || bulkMode !== 'text') && parsedSources.length === 0)}
                  >
                    {bulkImport.isPending || createSource.isPending ? '正在导入...' : '开始导入'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
