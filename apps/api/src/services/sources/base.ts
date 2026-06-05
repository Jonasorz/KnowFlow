import type { WechatAccountSearchResult, WechatArticle, ArticleInfo } from '@knowflow/shared';

/**
 * Abstract base class for content source adapters.
 * Each content source (WeChat, Twitter, Podcast, etc.) must implement this interface.
 */
export abstract class SourceAdapter {
  abstract readonly type: string;

  /**
   * Search for accounts/channels within this source.
   * @param query - search query string
   * @returns Array of matching accounts with metadata
   */
  abstract search(query: string): Promise<WechatAccountSearchResult[]>;

  /**
   * Fetch a list of articles/posts from a source identifier.
   * @param identifier - source-specific identifier (e.g. biz for WeChat)
   * @param page - page number for pagination
   * @returns Array of articles (lightweight, without full content)
   */
  abstract fetchArticles(
    identifier: string,
    page?: number
  ): Promise<WechatArticle[]>;

  /**
   * Fetch the full content of a single article.
   * @param url - article URL
   * @returns Full article content including HTML and stats
   */
  abstract fetchArticleContent(url: string): Promise<{
    html: string;
    text: string;
    readCount?: number;
    likeCount?: number;
  }>;
}
