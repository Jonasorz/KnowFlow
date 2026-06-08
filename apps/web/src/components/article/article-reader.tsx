import { useEffect, useState, useRef, useMemo } from 'react';
import { useArticle, useToggleStar, useTranscribeArticle, useIdentifySpeakers, useApplySpeakerMapping } from '@/hooks/use-articles';
import { useAppStore } from '@/stores/app-store';
import { useAudioStore } from '@/stores/audio-store';
import { useAiStream, useAiResults } from '@/hooks/use-ai';
import { useSettings, useOpenRouterModels } from '@/hooks/use-settings';
import { useQueryClient, useMutationState } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip } from '@/components/ui/tooltip';
import { SummaryView } from '@/components/ai/summary-view';
import { MindmapView } from '@/components/ai/mindmap-view';
import { cn, formatRelativeDate } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Star,
  Sparkles,
  ExternalLink,
  Clock,
  Eye,
  User,
  UserCheck,
  Download,
  Headphones,
  FileText,
  Loader2,
  MessageSquare,
  Play,
  Pause,
  Network,
  RotateCw,
  ChevronDown,
  Check,
  Square,
  BookOpen,
} from 'lucide-react';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { AIModel } from '@knowflow/shared';

const staticModels: { value: AIModel; label: string }[] = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'kimi-k2.6', label: 'Kimi (K2.6)' },
  { value: 'kimi-8k', label: 'Kimi (8k)' },
  { value: 'kimi-32k', label: 'Kimi (32k)' },
];

function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const main = document.querySelector('main');
      if (!main) return;
      const scrollTop = main.scrollTop;
      const scrollHeight = main.scrollHeight - main.clientHeight;
      if (scrollHeight > 0) {
        setProgress(Math.min((scrollTop / scrollHeight) * 100, 100));
      }
    };

    const main = document.querySelector('main');
    if (main) {
      main.addEventListener('scroll', handleScroll, { passive: true });
      return () => main.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-transparent">
      <div
        className="h-full bg-primary transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function ReaderSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Skeleton className="mb-2 h-4 w-32" />
      <Skeleton className="mb-3 h-10 w-full" />
      <Skeleton className="mb-1 h-10 w-3/4" />
      <div className="flex gap-3 my-6">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Separator className="my-6" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="mb-4 h-4 w-full" />
      ))}
      <Skeleton className="mb-4 h-4 w-2/3" />
      <Skeleton className="my-6 h-48 w-full rounded-xl" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="mb-4 h-4 w-full" />
      ))}
    </div>
  );
}

function cleanArticleHtml(html: string): string {
  if (!html) return '';

  let clean = html;

  // Remove doctype
  clean = clean.replace(/<!DOCTYPE[^>]*>/gi, '');

  // Remove html, head, body tags (keeping their contents)
  clean = clean.replace(/<\/?(html|head|body)[^>]*>/gi, '');

  // Remove script tags to prevent XSS or unwanted scripts
  clean = clean.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');

  // Remove style tags which cause global style bleeding (e.g. body { width: 75% })
  clean = clean.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '');

  // Remove link tags pointing to stylesheets
  clean = clean.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '');

  return clean.trim();
}

function cleanTranscriptHtml(html: string): string {
  if (!html) return '';
  // Remove the text "点击跳转播放" from the transcript
  return html.replace(/<span class="text-\[9px\][^>]*>点击跳转播放<\/span>/gi, '');
}

function resolveOriginalUrl(url: string | null | undefined): string {
  if (!url) return '';
  const xyzMatch = url.match(/\/track\/[a-f0-9]{24}\/([a-f0-9]{24})/i);
  if (xyzMatch) {
    return `https://www.xiaoyuzhoufm.com/episode/${xyzMatch[1]}`;
  }
  return url;
}

function cleanSummaryFluff(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();
  
  const startMarkers = [
    '1. 🎙️',
    '1.🎙️',
    '🎙️',
    '1. **单集简介',
    '**单集简介',
    '# '
  ];
  
  for (const marker of startMarkers) {
    const idx = cleaned.indexOf(marker);
    if (idx !== -1 && idx < 300) {
      cleaned = cleaned.substring(idx);
      break;
    }
  }

  const trailingFluffRegex = /(?:---+\s*)?(?:希望(?:这期|这些|对您)?有帮助|以上就是|供您参考|感谢您的听写|让我们共同进步|如果你有其他问题).*\s*$/gi;
  cleaned = cleaned.replace(trailingFluffRegex, '').trim();
  
  return cleaned;
}

function extractEntitiesAndReferences(summaryText: string): string {
  if (!summaryText) return '';
  
  const lines = summaryText.split('\n');
  let startIdx = -1;
  let endIdx = -1;
  
  // Find where references & entities section starts
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      (line.includes('参考与实体') || line.includes('References & Entities') || (line.includes('参考') && line.includes('实体'))) &&
      (line.startsWith('#') || line.match(/^\d+/) || line.startsWith('**') || line.includes('📚') || line.startsWith('-'))
    ) {
      startIdx = i;
      break;
    }
  }
  
  if (startIdx === -1) {
    // Fallback: search for line containing "参考" or "Entities" as a header
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (
        (line.toLowerCase().includes('references') || line.includes('参考参考') || line.includes('提及的参考')) &&
        (line.startsWith('#') || line.match(/^\d+/) || line.startsWith('*') || line.startsWith('-') || line.startsWith('**'))
      ) {
        startIdx = i;
        break;
      }
    }
  }

  if (startIdx === -1) {
    return '';
  }

  // Find where it ends (usually the next header, e.g. "4. 🗺️ **思维导图大纲" or similar)
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      line.match(/^[#\d*\-]+.?\s*(🗺️|思维导图大纲|大纲|Outline|Conclusion|结语|总结|References)/i) ||
      (line.startsWith('#') && !line.includes('参考') && !line.includes('Entity') && !line.includes('Entities')) ||
      line.startsWith('**4.') || 
      line.startsWith('4.') ||
      (line.startsWith('**') && (line.includes('思维导图') || line.includes('大纲') || line.includes('Outline')))
    ) {
      endIdx = i;
      break;
    }
  }

  const sectionLines = endIdx === -1 ? lines.slice(startIdx) : lines.slice(startIdx, endIdx);
  
  // Shift off any leading lines that are empty or are headers or contain section title keywords
  while (sectionLines.length > 0) {
    const line = sectionLines[0].trim();
    if (!line) {
      sectionLines.shift();
      continue;
    }
    
    // Check if the line is a list item or start of the actual content
    const isListItem = /^[-\*•]\s+/.test(line);
    const isNumberedListItem = /^\d+\.\s+/.test(line) && !line.includes('参考') && !line.includes('实体') && !line.toLowerCase().includes('reference') && !line.toLowerCase().includes('entity');
    
    // Check if the line is a header or title
    const isHeader = line.startsWith('#') || line.startsWith('**') || line.startsWith('__');
    const isHorizontalRule = /^[-\*_]{3,}$/.test(line);
    const containsKeyword = line.includes('参考与实体') || 
                            line.includes('References & Entities') || 
                            line.includes('节目中提到的') || 
                            line.includes('提及的参考') || 
                            line.includes('参考实体') ||
                            (line.includes('参考') && line.includes('实体')) || 
                            line.toLowerCase().includes('references') || 
                            line.toLowerCase().includes('entities') ||
                            line.toLowerCase().includes('reference & entity');
                            
    const isIntroFluff = line.startsWith('以下是') || line.endsWith('如下：') || line.endsWith('如下:');

    if ((isHeader || containsKeyword || isHorizontalRule || isIntroFluff) && !isListItem && !isNumberedListItem) {
      sectionLines.shift();
    } else {
      break;
    }
  }
  
  return sectionLines.join('\n').trim();
}


export function ArticleReader() {
  const params = useParams({ from: '/article/$id' });
  const { data: article, isLoading } = useArticle(params.id);
  const navigate = useNavigate();
  const toggleStar = useToggleStar();
  const transcribeArticle = useTranscribeArticle();
  const identifySpeakers = useIdentifySpeakers();
  const applySpeakerMapping = useApplySpeakerMapping();

  // Track pending transcriptions globally via React Query mutation state
  const pendingMutations = useMutationState({
    filters: { mutationKey: ['transcribe-article'], status: 'pending' },
    select: (mutation) => ({
      id: mutation.state.variables as string,
      submittedAt: mutation.state.submittedAt,
    }),
  });

  const currentPending = article ? pendingMutations.find((m) => m.id === article.id) : undefined;
  const isTranscribingThis = !!currentPending;
  const otherTranscriptionsCount = article 
    ? pendingMutations.filter((m) => m.id !== article.id).length 
    : pendingMutations.length;

  const { openAiSidebar } = useAppStore();
  const { playTrack, currentTrack, seekTo, currentTime, isPlaying, setPlaying } = useAudioStore();

  const queryClient = useQueryClient();
  const { content: summaryContent, isStreaming: isSummaryStreaming, startStream: startSummary, stopStream: stopSummary, reset: resetSummary } = useAiStream();
  const { content: mindmapContent, isStreaming: isMindmapStreaming, startStream: startMindmap, stopStream: stopMindmap, reset: resetMindmap } = useAiStream();
  
  const { data: existingResults } = useAiResults(params.id || '');
  const { data: settings } = useSettings();
  const { data: openRouterModels } = useOpenRouterModels();

  const [readerTab, setReaderTab] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedModel, setSelectedModel] = useState<AIModel>('deepseek-chat');
  const [modelSearch, setModelSearch] = useState('');
  const [entitiesTriggered, setEntitiesTriggered] = useState(false);
  const [isSpeakerModalOpen, setIsSpeakerModalOpen] = useState(false);
  const [speakersToMap, setSpeakersToMap] = useState<string[]>([]);
  const [speakerMapping, setSpeakerMapping] = useState<Record<string, string>>({});
  const [isCustomEditing, setIsCustomEditing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const lastAutoScrollRef = useRef<boolean>(true);
  const lastScrolledTimeRef = useRef<number>(-1);

  // Simulated transcription progress
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTranscribingThis && currentPending) {
      const updateProgress = () => {
        const elapsed = Date.now() - currentPending.submittedAt;
        const estimatedTotalMs = (article?.duration ? Math.max(article.duration * 0.02, 30) : 90) * 1000;
        const ratio = elapsed / estimatedTotalMs;
        const rawProgress = Math.round(98 * (1 - Math.exp(-2.5 * ratio)));
        setTranscribeProgress(Math.max(1, Math.min(rawProgress, 98)));
      };

      updateProgress();
      timer = setInterval(updateProgress, 1000);
    } else {
      setTranscribeProgress(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isTranscribingThis, currentPending, article?.duration]);

  // Set default model from settings
  useEffect(() => {
    if (settings?.defaultAIModel) {
      setSelectedModel(settings.defaultAIModel);
    }
  }, [settings?.defaultAIModel]);

  // Reset streaming state on article change
  useEffect(() => {
    resetSummary();
    resetMindmap();
    setEntitiesTriggered(false);
  }, [params.id, resetSummary, resetMindmap]);

  const allModels = useMemo(() => {
    const list = [...staticModels];
    if (openRouterModels && Array.isArray(openRouterModels)) {
      openRouterModels.forEach((m: any) => {
        list.push({
          value: `openrouter/${m.id}`,
          label: `OpenRouter: ${m.name || m.id}`,
        });
      });
    }
    return list;
  }, [openRouterModels]);

  const filteredModels = useMemo(() => {
    return allModels.filter((m) =>
      m.label.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.value.toLowerCase().includes(modelSearch.toLowerCase())
    );
  }, [allModels, modelSearch]);

  const selectedModelLabel = useMemo(() => {
    return allModels.find((m) => m.value === selectedModel)?.label || selectedModel;
  }, [allModels, selectedModel]);

  const existingSummary = existingResults?.find((r) => r.skillType === 'summary')?.result;
  const displayedSummary = cleanSummaryFluff(summaryContent || existingSummary || '');

  const existingMindmap = existingResults?.find((r) => r.skillType === 'mindmap')?.result;
  const displayedMindmap = mindmapContent || existingMindmap || '';

  const isThisTrackPlaying = currentTrack?.id === article?.id && isPlaying;

  // Set default tab on article load
  useEffect(() => {
    if (article) {
      setReaderTab(article.sourceType === 'podcast' ? 'shownotes' : 'content');
    }
  }, [article?.id, article?.sourceType]);

  // Tab configurations
  const tabs = useMemo(() => {
    if (!article) return [];
    if (article.sourceType === 'podcast') {
      return [
        { id: 'shownotes', label: '节目介绍', icon: <FileText className="h-3.5 w-3.5" /> },
        { id: 'transcript', label: '逐字稿', icon: <Headphones className="h-3.5 w-3.5" /> },
        { id: 'summary', label: 'AI 总结', icon: <Sparkles className="h-3.5 w-3.5" /> },
        { id: 'mindmap', label: '思维导图', icon: <Network className="h-3.5 w-3.5" /> },
        { id: 'entities', label: '参考与实体', icon: <BookOpen className="h-3.5 w-3.5" /> },
      ];
    } else {
      const label = article.sourceType === 'wechat' ? '公众号文章' : article.sourceType === 'twitter' ? 'X (Twitter)' : '内容阅读';
      return [
        { id: 'content', label, icon: <FileText className="h-3.5 w-3.5" /> },
        { id: 'summary', label: 'AI 总结', icon: <Sparkles className="h-3.5 w-3.5" /> },
        { id: 'mindmap', label: '思维导图', icon: <Network className="h-3.5 w-3.5" /> },
      ];
    }
  }, [article]);

  // Highlight active transcript paragraph and handle auto-scroll
  useEffect(() => {
    if (readerTab !== 'transcript' || currentTrack?.id !== article?.id || !contentRef.current) return;

    const container = contentRef.current;
    const segments = Array.from(container.querySelectorAll('[data-segment-time]'));
    if (segments.length === 0) return;

    let activeSeg: Element | null = null;
    let maxTime = -1;

    // Find segment that matches the current playback time
    for (const seg of segments) {
      const timeAttr = seg.getAttribute('data-segment-time');
      if (timeAttr) {
        const time = parseInt(timeAttr, 10);
        if (!isNaN(time) && time <= currentTime && time > maxTime) {
          maxTime = time;
          activeSeg = seg;
        }
      }
    }

    // Apply active classes
    segments.forEach((seg) => {
      if (seg === activeSeg) {
        seg.classList.add('bg-primary/5', 'border-l-primary', 'shadow-sm');
        seg.classList.remove('border-transparent');
      } else {
        seg.classList.remove('bg-primary/5', 'border-l-primary', 'shadow-sm');
        seg.classList.add('border-transparent');
      }
    });

    if (activeSeg) {
      const activeTime = parseInt(activeSeg.getAttribute('data-segment-time') || '0', 10);
      const autoScrollToggledOn = autoScroll && !lastAutoScrollRef.current;
      lastAutoScrollRef.current = autoScroll;

      // Auto-scroll to active segment only when active segment changes or autoScroll is toggled on
      if (autoScroll && (activeTime !== lastScrolledTimeRef.current || autoScrollToggledOn)) {
        activeSeg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        lastScrolledTimeRef.current = activeTime;
      }
    } else {
      lastScrolledTimeRef.current = -1;
      lastAutoScrollRef.current = autoScroll;
    }
  }, [currentTime, readerTab, currentTrack?.id, article?.id, autoScroll]);

  const handleGenerate = async (skill: 'summary' | 'mindmap') => {
    if (!article) return;
    const fn = skill === 'summary' ? startSummary : startMindmap;
    try {
      await fn({
        articleId: article.id,
        skill,
        model: selectedModel,
        webSearch: false,
      });
      queryClient.invalidateQueries({ queryKey: ['ai-results', article.id] });
    } catch (err) {
      console.error('Failed to generate:', err);
    }
  };

  const handleIdentifySpeakersClick = async () => {
    if (!article) return;
    try {
      setIsCustomEditing(false);
      const res = await identifySpeakers.mutateAsync(article.id);
      if (res && res.mapping) {
        setSpeakersToMap(res.speakers || Object.keys(res.mapping));
        setSpeakerMapping(res.mapping);
        setIsSpeakerModalOpen(true);
      }
    } catch (err) {
      console.error('Speaker identification error:', err);
    }
  };

  const handleRenameSpeakersClick = () => {
    if (!article || !article.transcriptText) return;
    setIsCustomEditing(true);
    
    // Extract speakers from transcriptText
    const lines = article.transcriptText.split('\n');
    const speakerRegex = /^\[\d{2}:\d{2}(?::\d{2})?\]\s+([^:]+):/;
    const uniqueSpeakersSet = new Set<string>();
    
    for (const line of lines) {
      const match = line.match(speakerRegex);
      if (match && match[1]) {
        uniqueSpeakersSet.add(match[1].trim());
      }
    }
    
    const speakers = Array.from(uniqueSpeakersSet);
    setSpeakersToMap(speakers);
    
    // Pre-fill mapping with the current names (identity mapping)
    const initialMapping: Record<string, string> = {};
    for (const s of speakers) {
      initialMapping[s] = s;
    }
    setSpeakerMapping(initialMapping);
    setIsSpeakerModalOpen(true);
  };


  if (isLoading) {
    return <ReaderSkeleton />;
  }

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h3 className="text-lg font-semibold mb-2">Article not found</h3>
        <Button variant="outline" onClick={() => navigate({ to: '/' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Go back
        </Button>
      </div>
    );
  }

  const handlePlayClick = () => {
    if (!article.audioUrl) return;
    if (currentTrack?.id === article.id) {
      setPlaying(!isPlaying);
    } else {
      playTrack({
        id: article.id,
        title: article.title,
        podcastName: article.sourceName || '未知播客',
        audioUrl: article.audioUrl,
        coverUrl: article.coverImageUrl ?? undefined,
      });
    }
  };

  const handleTranscriptClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    
    // Check for explicit 'data-time' (on the timestamp span)
    let timeAttr = target.getAttribute('data-time') || target.closest('[data-time]')?.getAttribute('data-time');
    let isFallback = false;
    
    // Fallback: check for 'data-segment-time' (on the paragraph container div)
    if (!timeAttr) {
      timeAttr = target.getAttribute('data-segment-time') || target.closest('[data-segment-time]')?.getAttribute('data-segment-time');
      isFallback = true;
    }
    
    if (timeAttr) {
      // If we clicked on the paragraph (fallback), check if the user is selecting text (e.g. copying text).
      // On explicit timestamp clicks, we ignore selection checks and always seek.
      if (isFallback) {
        const selection = window.getSelection()?.toString();
        if (selection && selection.trim().length > 0) {
          return;
        }
      }
      
      const time = parseInt(timeAttr, 10);
      if (!isNaN(time)) {
        // Load track first if it is not the current track
        if (currentTrack?.id !== article.id && article.audioUrl) {
          playTrack({
            id: article.id,
            title: article.title,
            podcastName: article.sourceName || '未知播客',
            audioUrl: article.audioUrl,
            coverUrl: article.coverImageUrl ?? undefined,
          });
        }
        seekTo(time);
        setPlaying(true);
      }
    }
  };

  const handleDownloadTranscript = () => {
    if (!article.transcriptText) return;
    const blob = new Blob([article.transcriptText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${article.title}_逐字稿.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAllMarkdown = () => {
    if (!article) return;

    // Helper to serialize MindMapNode to Mermaid mindmap syntax
    const serializeToMermaid = (node: any, depth = 0): string => {
      const indent = '  '.repeat(depth + 1);
      const escapedLabel = node.label.replace(/"/g, '\\"').trim();
      let result = `${indent}"${escapedLabel}"\n`;
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          result += serializeToMermaid(child, depth + 1);
        }
      }
      return result;
    };

    let mindmapMarkdown = '';
    if (displayedMindmap) {
      try {
        let cleanJson = displayedMindmap.trim();
        if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
        else if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
        if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
        const parsed = JSON.parse(cleanJson.trim());
        
        const rootLabel = parsed.label.replace(/"/g, '\\"').trim();
        // Root is indented by 2 spaces, level-1 branches by 4 spaces, level-2 leaves by 6 spaces.
        // Wrapping the entire root label in double quotes directly avoids the parser conflicts caused by shape double-parens.
        mindmapMarkdown = '```mermaid\nmindmap\n  "' + rootLabel + '"\n' + 
          parsed.children.map((c: any) => serializeToMermaid(c, 1)).join('') + '```';
      } catch (e) {
        mindmapMarkdown = '```json\n' + displayedMindmap + '\n```';
      }
    }

    const doc = `# ${article.title}

 - **主播/作者**: ${article.author || '未知'}
 - **音频链接**: ${article.audioUrl || '无'}
 - **原文链接**: ${resolveOriginalUrl(article.originalUrl) || '无'}

 ---

 ## 🎙️ 节目介绍 (Show Notes)
 ${article.contentText?.trim() || '（为空）'}

 ---

 ## 📝 AI 总结 (AI Summary)
 ${displayedSummary?.trim() || '（为空）'}

 ---

 ## 🗺️ 思维导图 (Mind Map)
 ${mindmapMarkdown?.trim() || '（为空）'}

 ---

 ## 📄 逐字稿 (Transcript)
 ${article.transcriptText?.trim() || '（为空）'}
 `;

    const blob = new Blob([doc], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${article.title}_全套备份.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const isCurrentStreaming = readerTab === 'summary' || readerTab === 'entities' ? isSummaryStreaming : isMindmapStreaming;
  const currentContent = readerTab === 'summary' 
    ? displayedSummary 
    : readerTab === 'entities'
      ? extractEntitiesAndReferences(displayedSummary)
      : displayedMindmap;

  return (
    <>
      <ReadingProgressBar />

      <article className="animate-fade-in mx-auto px-6 py-8 max-w-6xl w-full">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/' })}
          className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        {/* Header with Two-column layout */}
        <header className="mb-6">
          <div className="flex flex-row gap-4 md:gap-6 items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* Source */}
              <div className="mb-2.5 flex items-center gap-2 text-xs text-muted-foreground select-none">
                <span className="font-semibold text-foreground/80">{article.sourceName || 'Unknown'}</span>
                {article.sourceType && (
                  <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider scale-95 origin-left px-1.5 py-0">
                    {article.sourceType}
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight tracking-tight mb-4 text-foreground">
                {article.title}
              </h1>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                {article.author && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span>{article.author}</span>
                  </div>
                )}
                {article.publishedAt && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatRelativeDate(article.publishedAt)}</span>
                  </div>
                )}
                {article.readCount !== undefined && article.readCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 shrink-0" />
                    <span>{article.readCount.toLocaleString()} reads</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cover Image next to title */}
            {article.coverImageUrl && (
              <img
                src={article.coverImageUrl}
                alt={article.title}
                className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-xl sm:rounded-2xl object-cover bg-muted border border-border shadow-sm shrink-0"
              />
            )}
          </div>
        </header>

        {/* Action Bar */}
        <div className="mb-8 flex items-center gap-2 rounded-xl bg-muted/50 p-2 select-none">
          {article.audioUrl && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handlePlayClick}
                className={cn(
                  "gap-1.5 shadow-sm text-xs h-8 font-semibold",
                  isThisTrackPlaying && "bg-emerald-600 hover:bg-emerald-500 animate-pulse text-white"
                )}
              >
                {isThisTrackPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5 fill-current" />
                    <span>正在播放</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current translate-x-[0.5px]" />
                    <span>播放音频</span>
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(article.audioUrl!, '_blank')}
                className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                <span>下载音频</span>
              </Button>
            </>
          )}

          <Tooltip content={article.isStarred ? 'Unstar' : 'Star'}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleStar(article.id, article.isStarred)}
              className={cn('h-8 text-xs', article.isStarred && 'text-amber-500')}
            >
              <Star className={cn('h-3.5 w-3.5 mr-1', article.isStarred && 'fill-current')} />
              <span>{article.isStarred ? 'Starred' : 'Star'}</span>
            </Button>
          </Tooltip>

          <Tooltip content="AI 问答交流">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openAiSidebar(article.id)}
              className="h-8 text-xs"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              <span>AI 问答</span>
            </Button>
          </Tooltip>

          {article.originalUrl && (
            <Tooltip content="打开原文链接">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(resolveOriginalUrl(article.originalUrl), '_blank')}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                原文链接
              </Button>
            </Tooltip>
          )}

          <Tooltip content="导出全文至 Markdown">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportAllMarkdown}
              className="h-8 text-xs gap-1 hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              导出
            </Button>
          </Tooltip>

          <div className="flex-1" />
        </div>

        {/* Content Tab Swticher */}
        {tabs.length > 0 && (
          <div className="sticky top-0 z-30 bg-background pt-2 flex border-b border-border mb-6 overflow-x-auto select-none no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setReaderTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-[2px] whitespace-nowrap shrink-0',
                  readerTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content rendering based on active Tab */}
        {readerTab === 'shownotes' || readerTab === 'content' ? (
          /* Shownotes or WeChat/Twitter original article body */
          article.sourceType === 'wechat' && (article.contentHtml === null || article.contentHtml === undefined) ? (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-2xl bg-muted/10 my-8 w-full select-none">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
              <h3 className="text-sm font-semibold mb-1 text-foreground">
                正在从微信公众号获取文章正文...
              </h3>
              <p className="text-xs text-muted-foreground text-center max-w-sm leading-relaxed mb-6">
                首次打开此文章，系统正在后台同步解析并保存正文内容，这通常需要 1~2 秒，请稍候。
              </p>
              <div className="w-full max-w-xs bg-muted rounded-full h-1.5 overflow-hidden relative">
                <div className="bg-primary h-full rounded-full absolute top-0 left-0 w-1/2 animate-progress-bar" />
              </div>
            </div>
          ) : (
            <div
              ref={contentRef}
              className="prose-reader"
              dangerouslySetInnerHTML={{
                __html: article.contentHtml
                  ? cleanArticleHtml(article.contentHtml)
                  : article.contentText?.replace(/\n/g, '<br/>') || '<p>No content available.</p>',
              }}
            />
          )
        ) : readerTab === 'transcript' ? (
          /* Transcript Tab */
          <div className="space-y-4">
            {otherTranscriptionsCount > 0 && (
              <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/5 px-3.5 py-2 rounded-xl flex items-center gap-1.5 border border-amber-500/10 select-none animate-pulse shrink-0">
                <Loader2 className="h-3 w-3 animate-spin shrink-0 text-amber-500" />
                <span>提示：当前有 {otherTranscriptionsCount} 个其他节目正在后台并行转写中，完成后将自动保存。您可自由切换或离开。</span>
              </div>
            )}

            {!article.transcriptHtml ? (
              <div className="flex flex-col items-center justify-center p-10 border border-dashed border-border rounded-2xl bg-muted/10 my-8">
                <Headphones className="h-12 w-12 text-muted-foreground mb-4 stroke-[1.5]" />
                <h3 className="text-sm font-semibold mb-1 text-foreground">暂无逐字稿</h3>
                <p className="text-xs text-muted-foreground text-center max-w-sm mb-6 leading-relaxed">
                  本期单集尚未转录。您可以启动 AI 语音转写服务，自动识别音频并生成带时间戳和发言人的详细逐字稿。
                </p>
                
                {isTranscribingThis ? (
                  <Button disabled className="gap-2 text-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在转写音频 ({transcribeProgress}%)...
                  </Button>
                ) : (
                  <Button onClick={() => transcribeArticle.mutate(article.id)} className="gap-2 text-xs shadow-md">
                    <Sparkles className="h-3.5 w-3.5" />
                    生成 AI 逐字稿
                  </Button>
                )}
              </div>
            ) : (
              <div className="my-4">
                {/* Transcript header controls */}
                <div className="sticky top-[46px] z-20 bg-background py-2 mb-2 select-none">
                  <div className="flex items-center justify-between bg-muted/40 px-3.5 py-2 rounded-xl border border-border">
                    <span className="text-[11px] text-muted-foreground">💡 点击时间戳可跳转播放对应音频</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoScroll}
                          onChange={(e) => setAutoScroll(e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 accent-primary cursor-pointer"
                        />
                        自动滚动
                      </label>
                      <div className="h-3 w-[1px] bg-border" />
                      {isTranscribingThis ? (
                        <Button disabled className="h-7 text-xs px-2.5 gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          转写中 ({transcribeProgress}%)...
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => transcribeArticle.mutate(article.id)}
                          className="h-7 text-xs px-2.5 gap-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <RotateCw className="h-3 w-3" />
                          重新解析
                        </Button>
                      )}
                      <div className="h-3 w-[1px] bg-border" />
                      {identifySpeakers.isPending ? (
                        <Button disabled className="h-7 text-xs px-2.5 gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          识别中...
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleIdentifySpeakersClick}
                          className="h-7 text-xs px-2.5 gap-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="根据 Shownotes 分析并智能识别发言人姓名"
                        >
                          <UserCheck className="h-3 w-3" />
                          识别发言人
                        </Button>
                      )}
                      <div className="h-3 w-[1px] bg-border" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRenameSpeakersClick}
                        className="h-7 text-xs px-2.5 gap-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="手动修改或对调发言人真实姓名"
                      >
                        <User className="h-3 w-3" />
                        修改发言人
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Transcript list */}
                <div
                  ref={contentRef}
                  className="prose-reader podcast-transcript-container"
                  onClick={handleTranscriptClick}
                  dangerouslySetInnerHTML={{
                    __html: cleanTranscriptHtml(article.transcriptHtml),
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          /* AI Summary / Mindmap / Entities Tab */
          <div className="my-4">
            {readerTab === 'entities' && !entitiesTriggered && !isSummaryStreaming ? (
              /* References & Entities Manual Trigger Placeholder */
              <div className="flex flex-col items-center justify-center p-10 border border-dashed border-border rounded-2xl bg-muted/10 my-8">
                <BookOpen className="h-12 w-12 text-primary/60 mb-4 stroke-[1.5]" />
                {displayedSummary ? (
                  <>
                    <h3 className="text-sm font-semibold mb-1 text-foreground">
                      提取节目参考与实体
                    </h3>
                    <p className="text-xs text-muted-foreground text-center max-w-sm mb-6 leading-relaxed">
                      本期节目的 AI 总结已生成。点击下方按钮，智能提炼并展现节目中提到的所有参考资料与知识实体。
                    </p>
                    <Button size="sm" onClick={() => setEntitiesTriggered(true)} className="text-xs h-8 shadow-sm gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      提取参考与实体
                    </Button>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold mb-1 text-foreground">
                      暂无 AI 参考与实体
                    </h3>
                    <p className="text-xs text-muted-foreground text-center max-w-sm mb-6 leading-relaxed">
                      尚未为本篇内容生成 AI 总结。请在下方选择大语言模型，点击按钮开始生成总结并提炼其中的参考与知识实体。
                    </p>
                    
                    <div className="flex items-center gap-3 w-full max-w-md justify-center select-none">
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button variant="outline" size="sm" className="text-xs max-w-[200px] truncate h-8">
                            <span>{selectedModelLabel}</span>
                            <ChevronDown className="h-3 w-3 ml-1 text-muted-foreground shrink-0" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 max-h-[300px] overflow-y-auto">
                          <DropdownMenuLabel className="pb-1 text-xs">选择模型</DropdownMenuLabel>
                          <div className="px-2 pb-2 pt-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              placeholder="搜索模型..."
                              value={modelSearch}
                              onChange={(e) => setModelSearch(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <DropdownMenuSeparator />
                          {filteredModels.map((m) => (
                            <DropdownMenuItem key={m.value} onClick={() => setSelectedModel(m.value)}>
                              <span className="flex-1 text-xs truncate">{m.label}</span>
                              {selectedModel === m.value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button size="sm" onClick={() => {
                        handleGenerate('summary');
                        setEntitiesTriggered(true);
                      }} className="text-xs h-8 shadow-sm">
                        <Play className="h-3.5 w-3.5 mr-1" />
                        开始生成
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : !currentContent && !isCurrentStreaming ? (
              /* Generation Placeholder for Summary / Mindmap */
              <div className="flex flex-col items-center justify-center p-10 border border-dashed border-border rounded-2xl bg-muted/10 my-8">
                {readerTab === 'summary' ? (
                  <Sparkles className="h-12 w-12 text-primary/60 mb-4 stroke-[1.5] animate-pulse" />
                ) : (
                  <Network className="h-12 w-12 text-primary/60 mb-4 stroke-[1.5] animate-pulse" />
                )}
                <h3 className="text-sm font-semibold mb-1 text-foreground">
                  暂无 AI {readerTab === 'summary' ? '总结' : '导图'}
                </h3>
                <p className="text-xs text-muted-foreground text-center max-w-sm mb-6 leading-relaxed">
                  尚未为本篇内容生成 AI {readerTab === 'summary' ? '总结和深度知识要点' : '结构化思维脑图'}。请在下方选择大语言模型并开始生成。
                </p>
                
                <div className="flex items-center gap-3 w-full max-w-md justify-center select-none">
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button variant="outline" size="sm" className="text-xs max-w-[200px] truncate h-8">
                        <span>{selectedModelLabel}</span>
                        <ChevronDown className="h-3 w-3 ml-1 text-muted-foreground shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64 max-h-[300px] overflow-y-auto">
                      <DropdownMenuLabel className="pb-1 text-xs">选择模型</DropdownMenuLabel>
                      <div className="px-2 pb-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          placeholder="搜索模型..."
                          value={modelSearch}
                          onChange={(e) => setModelSearch(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <DropdownMenuSeparator />
                      {filteredModels.map((m) => (
                        <DropdownMenuItem key={m.value} onClick={() => setSelectedModel(m.value)}>
                          <span className="flex-1 text-xs truncate">{m.label}</span>
                          {selectedModel === m.value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
 
                  <Button size="sm" onClick={() => handleGenerate(readerTab as 'summary' | 'mindmap')} className="text-xs h-8 shadow-sm">
                    <Play className="h-3.5 w-3.5 mr-1" />
                    开始生成
                  </Button>
                </div>
              </div>
            ) : (
              /* Content view & Regenerate options */
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4 bg-muted/40 px-3.5 py-2 rounded-xl border border-border select-none">
                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                    {readerTab === 'summary' ? (
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    ) : readerTab === 'entities' ? (
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Network className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span>已生成 AI {readerTab === 'summary' ? '总结' : readerTab === 'entities' ? '参考与实体' : '导图'}</span>
                  </span>
                  
                  <div className="flex items-center gap-3">
                    {isCurrentStreaming ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (readerTab === 'summary' || readerTab === 'entities') stopSummary();
                          else stopMindmap();
                        }}
                        className="h-7 text-xs px-2.5 gap-1"
                      >
                        <Square className="h-3 w-3" />
                        停止生成
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2.5 gap-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                              <span>{selectedModelLabel}</span>
                              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64 max-h-[300px] overflow-y-auto">
                            <DropdownMenuLabel className="pb-1 text-xs">选择模型</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {filteredModels.map((m) => (
                              <DropdownMenuItem key={m.value} onClick={() => setSelectedModel(m.value)}>
                                <span className="flex-1 text-xs truncate">{m.label}</span>
                                {selectedModel === m.value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <div className="h-3 w-[1px] bg-border" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleGenerate(readerTab === 'entities' ? 'summary' : readerTab as 'summary' | 'mindmap')}
                          className="h-7 text-xs px-2.5 gap-1 hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <RotateCw className="h-3 w-3" />
                          重新生成
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
 
                {/* Actual Views */}
                {readerTab === 'summary' ? (
                  <SummaryView content={displayedSummary} isStreaming={isSummaryStreaming} />
                ) : readerTab === 'entities' ? (
                  !currentContent && isSummaryStreaming ? (
                    <div className="flex flex-col items-center justify-center p-10 border border-dashed border-border rounded-2xl bg-muted/10 my-8 w-full select-none animate-pulse">
                      <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                      <h3 className="text-sm font-semibold mb-1 text-foreground">
                        正在生成 AI 总结并提炼参考与实体...
                      </h3>
                      <p className="text-xs text-muted-foreground text-center max-w-sm leading-relaxed">
                        AI 正在撰写单集简介与核心要点，随后将自动提取提及的书籍、论文、人物及软硬件产品。
                      </p>
                    </div>
                  ) : !currentContent ? (
                    /* Summary exists but no entities were found */
                    <div className="flex flex-col items-center justify-center p-10 border border-dashed border-border rounded-2xl bg-muted/10 my-8 w-full">
                      <BookOpen className="h-12 w-12 text-muted-foreground mb-4 stroke-[1.5]" />
                      <h3 className="text-sm font-semibold mb-1 text-foreground">
                        未检测到参考与实体
                      </h3>
                      <p className="text-xs text-muted-foreground text-center max-w-sm mb-6 leading-relaxed">
                        本期节目的 AI 总结中未检测到参考与实体信息。您可以尝试选择其他大语言模型并重新生成总结。
                      </p>
                      <div className="flex items-center gap-3 w-full max-w-md justify-center select-none">
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button variant="outline" size="sm" className="text-xs max-w-[200px] truncate h-8">
                              <span>{selectedModelLabel}</span>
                              <ChevronDown className="h-3 w-3 ml-1 text-muted-foreground shrink-0" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-64 max-h-[300px] overflow-y-auto">
                            <DropdownMenuLabel className="pb-1 text-xs">选择模型</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {filteredModels.map((m) => (
                              <DropdownMenuItem key={m.value} onClick={() => setSelectedModel(m.value)}>
                                <span className="flex-1 text-xs truncate">{m.label}</span>
                                {selectedModel === m.value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button size="sm" onClick={() => handleGenerate('summary')} className="text-xs h-8 shadow-sm">
                          <RotateCw className="h-3.5 w-3.5 mr-1" />
                          重新生成
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                      <SummaryView content={currentContent} isStreaming={isSummaryStreaming} />
                    </div>
                  )
                ) : (
                  <MindmapView 
                    content={displayedMindmap} 
                    isStreaming={isMindmapStreaming} 
                    transcriptText={article.transcriptText || undefined}
                    shownotes={article.contentText || undefined}
                    showTimestamps={article.sourceType === 'podcast'}
                    onSeek={(time) => {
                      if (currentTrack?.id !== article.id && article.audioUrl) {
                        playTrack({
                          id: article.id,
                          title: article.title,
                          podcastName: article.sourceName || '未知播客',
                          audioUrl: article.audioUrl,
                          coverUrl: article.coverImageUrl ?? undefined,
                        });
                      }
                      seekTo(time);
                      setPlaying(true);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* End spacer */}
        <div className="h-24" />
      </article>

      <Dialog open={isSpeakerModalOpen} onOpenChange={setIsSpeakerModalOpen}>
        <DialogContent className="sm:max-w-[480px] select-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              {isCustomEditing ? (
                <>
                  <UserCheck className="h-5 w-5 text-primary" />
                  <span>重命名发言人</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span>发言人智能识别推荐</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {isCustomEditing 
                ? '在下方为逐字稿中的发言人指定新的姓名。您可以直接修改名字。如果需要对调姓名（如 A 和 B 的名字识别反了），直接互换输入框中的名字即可，系统会自动安全处理对调。'
                : 'AI 已为您分析播客内容并提出以下发言人姓名映射推荐。您可以核对并调整这些名字，确认无误后点击应用。互换名字即可实现无损对调。'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 py-2 my-2">
            {speakersToMap.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                未在逐字稿中提取到发言人标签
              </div>
            ) : (
              speakersToMap.map((speaker) => (
                <div key={speaker} className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-5 text-right font-medium text-xs text-muted-foreground truncate" title={speaker}>
                    {speaker}
                  </div>
                  <div className="col-span-2 text-center text-muted-foreground text-[10px] font-bold">
                    ➔
                  </div>
                  <div className="col-span-5">
                    <Input
                      type="text"
                      value={speakerMapping[speaker] || ''}
                      onChange={(e) => {
                        setSpeakerMapping({
                          ...speakerMapping,
                          [speaker]: e.target.value,
                        });
                      }}
                      placeholder={speaker}
                      className="h-8 text-xs px-2.5 bg-muted/20 border-border focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 border-t border-border pt-4 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSpeakerModalOpen(false)}
              className="h-8 text-xs"
            >
              取消
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={applySpeakerMapping.isPending || speakersToMap.length === 0}
              onClick={async () => {
                try {
                  await applySpeakerMapping.mutateAsync({
                    id: article.id,
                    mapping: speakerMapping,
                  });
                  setIsSpeakerModalOpen(false);
                } catch (err) {
                  console.error('Failed to apply speaker mapping:', err);
                }
              }}
              className="h-8 text-xs shadow-sm"
            >
              {applySpeakerMapping.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  应用中...
                </>
              ) : (
                '确认并应用'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
