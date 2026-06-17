import type {
  ApiResponse,
  PaginatedResponse,
  ArticleInfo,
  SourceInfo,
  ArticleFilter,
  CreateSourceInput,
  UpdateArticleInput,
  AIRequest,
  AIResultInfo,
  WechatAccountSearchResult,
  TwitterUserSearchResult,
  Settings,
  DajialaBalanceInfo,
  MoonshotBalanceInfo,
  DeepSeekBalanceInfo,
  TavilyUsageInfo,
  OpenRouterBalanceInfo,
  DashScopeBalanceInfo,
} from '@knowflow/shared';

const BASE_URL = '/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new ApiError(
      (error as { error?: string }).error || `Request failed: ${res.status}`,
      res.status,
      error
    );
  }

  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) {
    throw new ApiError(json.error || 'Unknown error', res.status);
  }

  return json.data as T;
}

// ── Sources ──
export const sourcesApi = {
  list: () => request<SourceInfo[]>('/sources'),
  get: (id: string) => request<SourceInfo>(`/sources/${id}`),
  create: (data: CreateSourceInput) =>
    request<SourceInfo>('/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<void>(`/sources/${id}`, { method: 'DELETE' }),
  update: (id: string, data: Partial<CreateSourceInput> & { isActive?: boolean }) =>
    request<SourceInfo>(`/sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  sync: (id: string) =>
    request<{ synced: number; total: number }>(`/sources/${id}/sync`, { method: 'POST' }),
  syncAll: () =>
    request<{ newArticles: number }>('/sources/sync', { method: 'POST' }),
  searchWechat: (query: string) =>
    request<WechatAccountSearchResult[]>(`/sources/wechat/search?q=${encodeURIComponent(query)}`),
  searchTwitter: (query: string) =>
    request<Array<WechatAccountSearchResult | TwitterUserSearchResult>>(`/sources/twitter/search?q=${encodeURIComponent(query)}`),
  searchPodcast: (query: string) =>
    request<any[]>(`/sources/podcast/search?q=${encodeURIComponent(query)}`),
  parseWechatBiz: (url: string) =>
    request<{ biz: string; name?: string; avatarUrl?: string }>(`/sources/wechat/parse-biz?url=${encodeURIComponent(url)}`),
  bulkImport: (params: {
    type: string;
    identifiers?: string[];
    sources?: Array<{ name: string; identifier: string; description?: string; avatarUrl?: string }>;
  }) =>
    request<Array<{ identifier: string; success: boolean; error?: string }>>('/sources/bulk-import', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  bulkUpdateTags: (params: { ids: string[]; tags: string[]; action: 'append' | 'overwrite' }) =>
    request<void>('/sources/bulk-update-tags', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  bulkDelete: (ids: string[]) =>
    request<void>('/sources/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
};

// ── Articles ──
export const articlesApi = {
  list: (filter?: Partial<ArticleFilter>) => {
    const params = new URLSearchParams();
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      });
    }
    const qs = params.toString();
    return request<PaginatedResponse<ArticleInfo>>(`/articles${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<ArticleInfo>(`/articles/${id}`),
  update: (id: string, data: UpdateArticleInput) =>
    request<ArticleInfo>(`/articles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  transcribe: (id: string) =>
    request<{ transcriptText: string; transcriptHtml: string }>(`/articles/${id}/transcribe`, {
      method: 'POST',
    }),
  identifySpeakers: (id: string) =>
    request<{ mapping: Record<string, string>; speakers: string[] }>(`/articles/${id}/identify-speakers`, {
      method: 'POST',
    }),
  applySpeakerMapping: (id: string, mapping: Record<string, string>) =>
    request<{ replacedCount: number }>(`/articles/${id}/apply-speaker-mapping`, {
      method: 'POST',
      body: JSON.stringify({ mapping }),
    }),
};

// ── AI ──
export const aiApi = {
  run: (data: AIRequest) =>
    request<AIResultInfo>('/ai/run', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  stream: async function* (data: AIRequest): AsyncGenerator<string> {
    const res = await fetch(`${BASE_URL}/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok || !res.body) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        (error as { error?: string }).error || `Stream request failed: ${res.status}`,
        res.status,
        error
      );
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        yield text;
      }
    } finally {
      reader.releaseLock();
    }
  },
  getResults: (articleId: string) =>
    request<AIResultInfo[]>(`/ai/results/${articleId}`),
};

// ── Settings ──
export const settingsApi = {
  get: () => request<Settings>('/settings'),
  update: (data: Partial<Settings>) =>
    request<Settings>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  testApiKey: (provider: string, key: string) =>
    request<{ valid: boolean }>(`/settings/test-key`, {
      method: 'POST',
      body: JSON.stringify({ provider, key }),
    }),
  getDajialaBalance: () =>
    request<DajialaBalanceInfo>('/settings/dajiala/balance'),
  getTwitterBalance: () =>
    request<{ recharge_credits: number }>('/settings/twitter/balance'),
  getMoonshotBalance: () =>
    request<MoonshotBalanceInfo>('/settings/moonshot/balance'),
  getDeepSeekBalance: () =>
    request<DeepSeekBalanceInfo>('/settings/deepseek/balance'),
  getTavilyBalance: () =>
    request<TavilyUsageInfo>('/settings/tavily/balance'),
  getOpenRouterBalance: () =>
    request<OpenRouterBalanceInfo>('/settings/openrouter/balance'),
  getDashScopeBalance: () =>
    request<DashScopeBalanceInfo>('/settings/dashscope/balance'),
  getOpenRouterModels: () =>
    request<any[]>('/settings/openrouter/models'),
};

export { ApiError };
