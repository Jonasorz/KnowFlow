import type { TwitterUserSearchResult } from '@knowflow/shared';
import { SourceAdapter } from './base.js';

// ============================================================
// In-memory cache for Twitter API
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

const CACHE_TTL = {
  TWEET_LIST: 15 * 60 * 1000,    // 15 minutes
  USER_SEARCH: 30 * 60 * 1000,   // 30 minutes
};

// ============================================================
// Helper to extract media URLs (robust parsing for V1.1/V2/Scraper)
// ============================================================
function extractMediaUrls(tweet: any, includes?: any): string[] {
  const urls: string[] = [];

  // Check direct media array if present (some scrapers do this)
  if (Array.isArray(tweet.media)) {
    for (const m of tweet.media) {
      if (m.url || m.media_url_https || m.media_url) {
        urls.push(m.url || m.media_url_https || m.media_url);
      }
    }
  }

  // Check standard v1.1 extended_entities
  if (tweet.extended_entities?.media && Array.isArray(tweet.extended_entities.media)) {
    for (const m of tweet.extended_entities.media) {
      if (m.media_url_https || m.media_url) {
        urls.push(m.media_url_https || m.media_url);
      }
    }
  }

  // Check standard v1.1 entities
  if (tweet.entities?.media && Array.isArray(tweet.entities.media)) {
    for (const m of tweet.entities.media) {
      if (m.media_url_https || m.media_url) {
        urls.push(m.media_url_https || m.media_url);
      }
    }
  }

  // Check standard v2 attachments + includes
  if (
    tweet.attachments?.media_keys &&
    Array.isArray(tweet.attachments.media_keys) &&
    includes?.media &&
    Array.isArray(includes.media)
  ) {
    const keyMap = new Map<string, string>();
    for (const m of includes.media) {
      if (m && m.media_key) {
        keyMap.set(m.media_key, m.url || m.preview_image_url || '');
      }
    }
    for (const key of tweet.attachments.media_keys) {
      const url = keyMap.get(key);
      if (url) {
        urls.push(url);
      }
    }
  }

  // Check for quoted tweet media recursively
  if (tweet.quoted_tweet) {
    urls.push(...extractMediaUrls(tweet.quoted_tweet, includes));
  }

  return Array.from(new Set(urls.filter(Boolean)));
}

// ============================================================
// Helper to format raw tweet text with hyperlinks
// ============================================================
function formatTweetTextToHtml(text: string, entities?: any): string {
  if (!text) return '';
  
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  if (!entities) {
    return html.replace(/\n/g, '<br />');
  }

  // Replace URLs
  if (Array.isArray(entities.urls)) {
    for (const urlObj of entities.urls) {
      if (!urlObj.url) continue;
      const expandedUrl = (urlObj.expanded_url || urlObj.url).replace(/&/g, '&amp;');
      const displayUrl = (urlObj.display_url || urlObj.url).replace(/&/g, '&amp;');
      
      html = html.replace(
        urlObj.url, 
        `<a href="${expandedUrl}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline break-all">${displayUrl}</a>`
      );
    }
  }

  // Replace User Mentions
  if (Array.isArray(entities.user_mentions)) {
    for (const mention of entities.user_mentions) {
      if (!mention.screen_name) continue;
      const screenName = mention.screen_name;
      const regex = new RegExp(`@${screenName}`, 'gi');
      html = html.replace(
        regex,
        `<a href="https://x.com/${screenName}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">@${screenName}</a>`
      );
    }
  }

  // Replace Hashtags
  if (Array.isArray(entities.hashtags)) {
    for (const hashtag of entities.hashtags) {
      if (!hashtag.text) continue;
      const tagText = hashtag.text;
      const regex = new RegExp(`#${tagText}`, 'gi');
      html = html.replace(
        regex,
        `<a href="https://x.com/hashtag/${tagText}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">#${tagText}</a>`
      );
    }
  }

  return html.replace(/\n/g, '<br />');
}

// ============================================================
// API base URL
// ============================================================
const API_BASE = 'https://api.twitterapi.io';

export class TwitterApiService {
  constructor(private apiKey: string) {}

  private async get<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${API_BASE}${endpoint}`);
    Object.entries(params).forEach(([key, val]) => url.searchParams.append(key, val));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Twitter API error [${response.status}] ${endpoint}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Search Twitter users by query keyword.
   */
  async searchUsers(query: string): Promise<TwitterUserSearchResult[]> {
    const cacheKey = `twitter:search:${query}`;
    const cached = cache.get<TwitterUserSearchResult[]>(cacheKey);
    if (cached) return cached;

    const data = await this.get<{
      users?: Array<{
        name: string;
        userName: string;
        id: string;
        profilePicture?: string;
        description?: string;
        followers?: number;
      }>;
      status?: string;
      msg?: string;
    }>('/twitter/user/search', { query });

    if (data.status === 'error') {
      throw new Error(data.msg || 'Twitter API returned an error during search');
    }

    const results: TwitterUserSearchResult[] = (data.users || []).map((user) => ({
      name: user.name,
      userName: user.userName,
      id: user.id,
      avatar: user.profilePicture,
      description: user.description,
      followers: user.followers,
    }));

    cache.set(cacheKey, results, CACHE_TTL.USER_SEARCH);
    return results;
  }

  /**
   * Get user timeline / last tweets by screen name.
   */
  async getUserTweets(userName: string): Promise<any> {
    const cacheKey = `twitter:tweets:${userName}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) return cached;

    const data = await this.get<any>('/twitter/user/last_tweets', { userName });
    
    // Cache the response
    cache.set(cacheKey, data, CACHE_TTL.TWEET_LIST);
    return data;
  }
}

// ============================================================
// TwitterSource — implements SourceAdapter
// ============================================================
export class TwitterSource extends SourceAdapter {
  readonly type = 'twitter';
  private api: TwitterApiService;

  constructor(apiKey: string) {
    super();
    this.api = new TwitterApiService(apiKey);
  }

  async search(query: string): Promise<any[]> {
    // Map Twitter search results to a schema compatible with WeChatAccountSearchResult
    const users = await this.api.searchUsers(query);
    return users.map((user) => ({
      name: user.name,
      biz: user.userName, // we use userName as biz/identifier in client
      avatar: user.avatar,
      description: user.description,
      fans: user.followers,
      avgTopRead: undefined, // not applicable
    }));
  }

  async fetchArticles(userName: string, page?: number): Promise<any[]> {
    const response = await this.api.getUserTweets(userName);
    const tweets = response?.data?.tweets || response?.tweets || [];
    const includes = response?.data?.includes || response?.includes || {};

    return tweets.map((tweet: any) => {
      const authorName = tweet.author?.name || tweet.author?.userName || userName;
      const authorHandle = tweet.author?.userName || userName;

      // Extract all media URLs
      const mediaUrls = extractMediaUrls(tweet, includes);
      const coverImageUrl = mediaUrls[0] || undefined;

      // Formatting plain text content with HTML styling
      const formattedTextHtml = formatTweetTextToHtml(tweet.text, tweet.entities);

      // Reply banner
      let replyBannerHtml = '';
      if (tweet.isReply && tweet.inReplyToUsername) {
        replyBannerHtml = `
          <div class="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <span>回复给</span>
            <a href="https://x.com/${tweet.inReplyToUsername}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">@${tweet.inReplyToUsername}</a>
          </div>
        `;
      }

      // Media content
      let mediaHtml = '';
      if (mediaUrls.length > 0) {
        mediaHtml = '<div class="mt-4 grid gap-2">';
        for (const mUrl of mediaUrls) {
          mediaHtml += `<img src="${mUrl}" alt="Tweet Media" class="rounded-xl max-w-full h-auto border border-border" />`;
        }
        mediaHtml += '</div>';
      }

      // Quote Tweet representation
      let quotedHtml = '';
      if (tweet.quoted_tweet) {
        const qAuthor = tweet.quoted_tweet.author?.name || tweet.quoted_tweet.author?.userName || 'Twitter User';
        const qHandle = tweet.quoted_tweet.author?.userName || '';
        const qText = formatTweetTextToHtml(tweet.quoted_tweet.text, tweet.quoted_tweet.entities);
        const qMediaUrls = extractMediaUrls(tweet.quoted_tweet, includes);
        
        let qMediaHtml = '';
        if (qMediaUrls.length > 0) {
          qMediaHtml = '<div class="mt-2 grid gap-1.5">';
          for (const qMUrl of qMediaUrls) {
            qMediaHtml += `<img src="${qMUrl}" alt="Quoted Media" class="rounded-lg max-w-full h-auto border border-border" />`;
          }
          qMediaHtml += '</div>';
        }

        quotedHtml = `
          <div class="mt-4 p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="font-bold text-xs">${qAuthor}</span>
              ${qHandle ? `<span class="text-xs text-muted-foreground">@${qHandle}</span>` : ''}
            </div>
            <p class="text-xs text-foreground/90 leading-relaxed">${qText}</p>
            ${qMediaHtml}
          </div>
        `;
      }

      // Combine into beautiful HTML wrapper
      const contentHtml = `
        <div class="twitter-tweet-container font-sans text-foreground leading-normal max-w-2xl mx-auto py-2">
          ${replyBannerHtml}
          <div class="tweet-text text-base md:text-lg whitespace-pre-wrap">${formattedTextHtml}</div>
          ${mediaHtml}
          ${quotedHtml}
        </div>
      `;

      // Map tweet created_at to ISO string
      let publishedAt = new Date().toISOString();
      if (tweet.createdAt) {
        try {
          publishedAt = new Date(tweet.createdAt).toISOString();
        } catch (e) {
          // Fallback if Date parsing fails
        }
      }

      // Map to standard WechatArticle representation for DB storage compatibility
      return {
        title: tweet.text && tweet.text.length > 80 ? tweet.text.slice(0, 80) + '...' : tweet.text || 'Tweet',
        url: tweet.url || `https://x.com/${authorHandle}/status/${tweet.id}`,
        ctime: publishedAt,
        cover: coverImageUrl,
        author: authorName,
        digest: tweet.text || '', // Use raw text as digest/summary
        // We extend the object with text and HTML for custom insert
        contentText: tweet.text || '',
        contentHtml: contentHtml,
        likeCount: tweet.likeCount,
        readCount: tweet.viewCount,
        commentCount: tweet.replyCount,
      };
    });
  }

  async fetchArticleContent(url: string): Promise<{
    html: string;
    text: string;
    readCount?: number;
    likeCount?: number;
  }> {
    // Should rarely be called if we save text and HTML during fetchArticles sync
    return {
      html: '',
      text: '',
    };
  }
}
