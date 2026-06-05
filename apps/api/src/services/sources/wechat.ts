import type { WechatAccountSearchResult, WechatArticle } from '@knowflow/shared';
import { SourceAdapter } from './base.js';

// ============================================================
// In-memory cache
// ============================================================
interface CacheEntry<T> {
  data: T;
  expiresAt: number; // timestamp in ms, 0 = permanent
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number = 0): void {
    this.store.set(key, {
      data,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

const cache = new MemoryCache();

// Cache TTLs
const CACHE_TTL = {
  ARTICLE_LIST: 30 * 60 * 1000,   // 30 minutes
  ARTICLE_CONTENT: 0,              // permanent (0 = no expiry)
  STATS: 60 * 60 * 1000,           // 1 hour
  SEARCH: 30 * 60 * 1000,          // 30 minutes
};

// ============================================================
// Rate limiter — 200ms delay between API calls
// ============================================================
let lastCallTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < 200) {
    await new Promise((resolve) => setTimeout(resolve, 200 - elapsed));
  }
  lastCallTime = Date.now();
}

// ============================================================
// API base URL and key
// ============================================================
const API_BASE = 'https://www.dajiala.com/fbmain/monitor/v3';

/**
 * Low-level WeChat API service wrapping the 极致了 API.
 */
export class WechatApiService {
  constructor(private apiKey: string) {}

  private async post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    await rateLimit();

    const url = `${API_BASE}/${endpoint}`;
    const payload = { key: this.apiKey, ...body };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `WeChat API error [${response.status}] ${endpoint}: ${text}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Search WeChat official accounts by keyword.
   */
  async searchAccount(query: string): Promise<WechatAccountSearchResult[]> {
    const cacheKey = `wechat:search:${query}`;
    const cached = cache.get<WechatAccountSearchResult[]>(cacheKey);
    if (cached) return cached;

    const data = await this.post<{
      code: number;
      data: Array<{
        name: string;
        biz: string;
        avatar?: string;
        owner_name?: string;
        fans?: number;
        avg_top_read?: number;
      }>;
    }>('wx_account/search', { keyword: query });

    console.log('[Search WeChat] Raw data from Dajiala:', JSON.stringify(data));

    const results: WechatAccountSearchResult[] = (data.data || []).map((item) => ({
      name: item.name,
      biz: item.biz,
      avatar: item.avatar,
      description: item.owner_name,
      fans: item.fans,
      avgTopRead: item.avg_top_read,
    }));

    cache.set(cacheKey, results, CACHE_TTL.SEARCH);
    return results;
  }

  /**
   * Get post history for a WeChat official account.
   */
  async getPostHistory(biz: string, page: number = 1): Promise<WechatArticle[]> {
    const cacheKey = `wechat:history:${biz}:${page}`;
    const cached = cache.get<WechatArticle[]>(cacheKey);
    if (cached) return cached;

    const data = await this.post<{
      code: number;
      data: Array<{
        title: string;
        url: string;
        ctime: string;
        cover?: string;
        author?: string;
        digest?: string;
      }>;
    }>('post_history', { biz, page });

    const articles: WechatArticle[] = (data.data || []).map((item) => ({
      title: item.title,
      url: item.url,
      ctime: item.ctime,
      cover: item.cover,
      author: item.author,
      digest: item.digest,
    }));

    cache.set(cacheKey, articles, CACHE_TTL.ARTICLE_LIST);
    return articles;
  }

  /**
   * Get the full HTML content of an article.
   */
  async getArticleHtml(url: string): Promise<string> {
    const cacheKey = `wechat:html:${url}`;
    const cached = cache.get<string>(cacheKey);
    if (cached) return cached;

    const data = await this.post<{
      code: number;
      data: { html: string };
    }>('article_html', { url });

    const html = data.data?.html || '';
    cache.set(cacheKey, html, CACHE_TTL.ARTICLE_CONTENT); // permanent
    return html;
  }

  /**
   * Get article detail (structured data).
   */
  async getArticleDetail(url: string): Promise<{
    title: string;
    author: string;
    content: string;
    publishTime: string;
  }> {
    const cacheKey = `wechat:detail:${url}`;
    const cached = cache.get<{
      title: string;
      author: string;
      content: string;
      publishTime: string;
    }>(cacheKey);
    if (cached) return cached;

    const data = await this.post<{
      code: number;
      data: {
        title?: string;
        author?: string;
        content?: string;
        publish_time?: string;
      };
    }>('article_detail', { url });

    const detail = {
      title: data.data?.title || '',
      author: data.data?.author || '',
      content: data.data?.content || '',
      publishTime: data.data?.publish_time || '',
    };

    cache.set(cacheKey, detail, CACHE_TTL.ARTICLE_CONTENT); // permanent
    return detail;
  }

  /**
   * Get read count and like count for an article.
   */
  async getReadZan(url: string): Promise<{ readCount: number; likeCount: number }> {
    const cacheKey = `wechat:stats:${url}`;
    const cached = cache.get<{ readCount: number; likeCount: number }>(cacheKey);
    if (cached) return cached;

    const data = await this.post<{
      code: number;
      data: {
        read_count?: number;
        like_count?: number;
      };
    }>('read_zan_pro', { url });

    const stats = {
      readCount: data.data?.read_count ?? 0,
      likeCount: data.data?.like_count ?? 0,
    };

    cache.set(cacheKey, stats, CACHE_TTL.STATS);
    return stats;
  }
}

// ============================================================
// WechatSource — implements SourceAdapter
// ============================================================
export class WechatSource extends SourceAdapter {
  readonly type = 'wechat';
  private api: WechatApiService;

  constructor(apiKey: string) {
    super();
    this.api = new WechatApiService(apiKey);
  }

  async search(query: string): Promise<WechatAccountSearchResult[]> {
    return this.api.searchAccount(query);
  }

  async fetchArticles(biz: string, page?: number): Promise<WechatArticle[]> {
    return this.api.getPostHistory(biz, page);
  }

  async fetchArticleContent(url: string): Promise<{
    html: string;
    text: string;
    readCount?: number;
    likeCount?: number;
  }> {
    // Fetch HTML, detail and stats in parallel
    const [html, detail, stats] = await Promise.all([
      this.api.getArticleHtml(url),
      this.api.getArticleDetail(url),
      this.api.getReadZan(url),
    ]);

    return {
      html,
      text: detail.content,
      readCount: stats.readCount,
      likeCount: stats.likeCount,
    };
  }
}
