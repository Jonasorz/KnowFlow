import { SourceAdapter } from './base.js';

function getTagContent(xmlSegment: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\/${tagName}>`, 'i');
  const match = xmlSegment.match(regex);
  if (!match) return '';
  let content = match[1].trim();
  // Strip CDATA wrapper
  if (content.startsWith('<![CDATA[') && content.endsWith(']]>')) {
    content = content.substring(9, content.length - 3).trim();
  }
  return content;
}

function getAttributeValue(xmlSegment: string, tagName: string, attrName: string): string {
  const regex = new RegExp(`<${tagName}\\s+[^>]*?${attrName}\\s*=\\s*["']([^"']+)["']`, 'i');
  const match = xmlSegment.match(regex);
  return match ? match[1].trim() : '';
}

function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(Number);
  if (parts.some(isNaN)) {
    const parsed = parseInt(durationStr, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

export class PodcastSource extends SourceAdapter {
  readonly type = 'podcast';

  /**
   * Search for podcasts via iTunes Search API
   */
  async search(query: string): Promise<any[]> {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&entity=podcast&limit=15`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      
      if (!response.ok) {
        throw new Error(`iTunes Search API error [${response.status}]`);
      }
      
      const data = await response.json() as any;
      const results = data.results || [];
      
      return results
        .filter((item: any) => item.feedUrl)
        .map((item: any) => ({
          name: item.collectionName || item.artistName || '未知播客',
          biz: item.feedUrl, // we store the RSS feedUrl as biz/identifier
          avatar: item.artworkUrl600 || item.artworkUrl100 || '',
          description: `主播: ${item.artistName || '未知'} | 分类: ${Array.isArray(item.genres) ? item.genres.join(', ') : (item.primaryGenreName || '未分类')}`,
          fans: undefined,
          avgTopRead: undefined,
        }));
    } catch (err) {
      console.error('iTunes Search API failed:', err);
      throw err;
    }
  }

  /**
   * Fetch podcast episodes from RSS XML Feed URL
   */
  async fetchArticles(feedUrl: string, page?: number): Promise<any[]> {
    try {
      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch RSS Feed [${response.status}]`);
      }
      
      const xml = await response.text();
      
      // Extract channel level fallback image
      const channelArtwork = getAttributeValue(xml, 'itunes:image', 'href') || getAttributeValue(xml, 'image', 'href');
      const channelAuthor = getTagContent(xml, 'itunes:author') || getTagContent(xml, 'itunes:owner') || '';

      // Parse individual items
      const items: string[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        items.push(match[1]);
      }
      
      // Map items to standard articles
      return items.map((item) => {
        const title = getTagContent(item, 'title') || '无标题单集';
        const link = getTagContent(item, 'link') || feedUrl;
        const pubDateStr = getTagContent(item, 'pubDate');
        
        let publishedAt = new Date().toISOString();
        if (pubDateStr) {
          try {
            publishedAt = new Date(pubDateStr).toISOString();
          } catch (e) {
            // Ignore format error
          }
        }
        
        // Extract enclosure / audio link
        const audioUrl = getAttributeValue(item, 'enclosure', 'url');
        
        // Extract duration
        const durationStr = getTagContent(item, 'itunes:duration') || getTagContent(item, 'duration');
        const durationSeconds = parseDuration(durationStr);
        
        // Extract cover image
        const itemArtwork = getAttributeValue(item, 'itunes:image', 'href') || getAttributeValue(item, 'image', 'href');
        const coverImageUrl = itemArtwork || channelArtwork || undefined;
        
        // Extract description/content
        const contentHtml = getTagContent(item, 'content:encoded') || getTagContent(item, 'description') || getTagContent(item, 'itunes:summary') || '暂无单集简介。';
        const contentText = contentHtml.replace(/<[^>]+>/g, '').trim() || contentHtml;
        const author = getTagContent(item, 'itunes:author') || channelAuthor || undefined;
        
        let resolvedUrl = link || audioUrl;
        if (resolvedUrl) {
          const xyzMatch = resolvedUrl.match(/\/track\/[a-f0-9]{24}\/([a-f0-9]{24})/i);
          if (xyzMatch) {
            resolvedUrl = `https://www.xiaoyuzhoufm.com/episode/${xyzMatch[1]}`;
          }
        }

        // Construct standard wrap
        return {
          title,
          url: resolvedUrl, // Use original link as unique key and original URL
          ctime: publishedAt,
          cover: coverImageUrl,
          author,
          digest: contentText.slice(0, 300) + (contentText.length > 300 ? '...' : ''),
          contentText,
          contentHtml,
          audioUrl,
          duration: durationSeconds,
        };
      });
    } catch (err) {
      console.error(`Failed to parse RSS feed ${feedUrl}:`, err);
      throw err;
    }
  }

  async fetchArticleContent(url: string): Promise<{
    html: string;
    text: string;
    readCount?: number;
    likeCount?: number;
  }> {
    return {
      html: '',
      text: '',
    };
  }
}
