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

  private async post<T>(endpoint: string, body: Record<string, unknown>, skipRateLimit = false): Promise<T> {
    if (!skipRateLimit) {
      await rateLimit();
    }

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

  async searchAccount(query: string): Promise<WechatAccountSearchResult[]> {
    throw new Error('微信公众号搜索接口已停用，以防产生高额按条查询费用。请直接在“手动添加”标签页中输入 Biz ID 或文章链接来订阅公众号（该方式完全免费，不调用收费接口）。');
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
      ctime: (item as any).post_time
        ? new Date((item as any).post_time * 1000).toISOString()
        : ((item as any).post_time_str
          ? new Date((item as any).post_time_str).toISOString()
          : item.ctime || new Date().toISOString()),
      cover: (item as any).cover_url || item.cover,
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

    const data = await this.post<any>('article_detail', { url }, true);

    const detail = {
      title: data?.title || '',
      author: data?.author || '',
      content: data?.content || '',
      publishTime: data?.post_time_str || (data?.post_time ? new Date(data.post_time * 1000).toISOString() : ''),
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
    // 只获取详情内容即可，因为 getArticleDetail 返回的 content 已经是完整的 HTML，且包含标题和作者等元数据。
    // 这避免了发起两次繁重的外部网络 API 请求，从而将抓取耗时直接缩短了近一半。
    const detail = await this.api.getArticleDetail(url);

    // 清洗 HTML 标签获取纯文本正文
    const text = detail.content
      ? detail.content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
      : '';

    return {
      html: detail.content,
      text,
    };
  }
}
