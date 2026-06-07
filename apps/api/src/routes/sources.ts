import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@knowflow/db';
import { schema } from '@knowflow/db';
import { eq, sql, inArray, or } from 'drizzle-orm';
import {
  createSourceSchema,
  type ApiResponse,
  type SourceInfo,
  type WechatAccountSearchResult,
} from '@knowflow/shared';
import { WechatSource } from '../services/sources/wechat.js';
import { TwitterSource } from '../services/sources/twitter.js';
import { PodcastSource } from '../services/sources/podcast.js';
import { getDajialaApiKey, getTwitterApiKey } from '../services/settings.js';

const { sources, articles } = schema;

export const sourcesRoutes = new Hono();

// ============================================================
// POST /search — search for WeChat accounts
// ============================================================
sourcesRoutes.post('/search', async (c) => {
  const body = await c.req.json<{ query: string; type?: string }>();
  const { query, type = 'wechat' } = body;

  if (type !== 'wechat' && type !== 'twitter' && type !== 'podcast') {
    return c.json<ApiResponse>(
      { success: false, error: `Source type "${type}" is not supported yet` },
      400
    );
  }

  if (type === 'podcast') {
    const podcast = new PodcastSource();
    const results = await podcast.search(query);
    return c.json<ApiResponse<any[]>>({
      success: true,
      data: results,
    });
  }

  if (type === 'twitter') {
    const apiKey = await getTwitterApiKey();
    if (!apiKey) {
      return c.json<ApiResponse>(
        { success: false, error: 'Twitter API key (twitterApiKey) is not configured. Please set it in Settings.' },
        400
      );
    }
    const twitter = new TwitterSource(apiKey);
    const results = await twitter.search(query);
    return c.json<ApiResponse<any[]>>({
      success: true,
      data: results,
    });
  }

  return c.json<ApiResponse>(
    { success: false, error: '微信公众号搜索接口已停用，以防产生高额按条查询费用。请直接在“手动添加”标签页中输入 Biz ID 或文章链接来订阅公众号（该方式完全免费，不调用收费接口）。' },
    400
  );
});

// ============================================================
// GET /wechat/search — search for WeChat accounts (frontend GET version)
// ============================================================
sourcesRoutes.get('/wechat/search', async (c) => {
  return c.json<ApiResponse>(
    { success: false, error: '微信公众号搜索接口已停用，以防产生高额按条查询费用。请直接在“手动添加”标签页中输入 Biz ID 或文章链接来订阅公众号（该方式完全免费，不调用收费接口）。' },
    400
  );
});

// ============================================================
// GET /twitter/search — search for Twitter users
// ============================================================
sourcesRoutes.get('/twitter/search', async (c) => {
  const query = c.req.query('q');

  if (!query || query.trim().length === 0) {
    return c.json<ApiResponse>(
      { success: false, error: 'Search query parameter "q" is required' },
      400
    );
  }

  const apiKey = await getTwitterApiKey();
  if (!apiKey) {
    return c.json<ApiResponse>(
      { success: false, error: 'Twitter API key (twitterApiKey) is not configured. Please set it in Settings.' },
      400
    );
  }

  const twitter = new TwitterSource(apiKey);
  const results = await twitter.search(query);

  return c.json<ApiResponse<any[]>>({
    success: true,
    data: results,
  });
});

// ============================================================
// GET /podcast/search — search for podcasts
// ============================================================
sourcesRoutes.get('/podcast/search', async (c) => {
  const query = c.req.query('q');

  if (!query || query.trim().length === 0) {
    return c.json<ApiResponse>(
      { success: false, error: 'Search query parameter "q" is required' },
      400
    );
  }

  try {
    const podcast = new PodcastSource();
    const results = await podcast.search(query);
    return c.json<ApiResponse<any[]>>({
      success: true,
      data: results,
    });
  } catch (err) {
    return c.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});

// ============================================================
// GET /wechat/parse-biz — extract biz ID from a WeChat article URL
// ============================================================
sourcesRoutes.get('/wechat/parse-biz', async (c) => {
  const url = c.req.query('url');

  if (!url || url.trim().length === 0) {
    return c.json<ApiResponse>(
      { success: false, error: 'Query parameter "url" is required' },
      400
    );
  }

  // 1. Try to extract fallback biz directly from URL query params
  let fallbackBiz = '';
  try {
    const parsedUrl = new URL(url);
    fallbackBiz = parsedUrl.searchParams.get('__biz') || '';
  } catch (e) {
    // Ignore URL parse error
  }

  // Double check in-text matching: __biz=xxx (in case URL parser missed it)
  if (!fallbackBiz) {
    const regexBiz = /__biz=([^&"'\s#]+)/;
    const matchBiz = url.match(regexBiz);
    if (matchBiz && matchBiz[1]) {
      fallbackBiz = matchBiz[1];
    }
  }

  // 2. Fetch page and parse biz, name, and avatarUrl
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      if (fallbackBiz) {
        return c.json({
          success: true,
          data: { biz: fallbackBiz, name: '微信公众号', avatarUrl: '' }
        });
      }
      return c.json<ApiResponse>(
        { success: false, error: `Failed to fetch WeChat page: ${response.statusText}` },
        400
      );
    }

    const html = await response.text();
    
    // Parse biz
    let biz = '';
    const bizPattern = /biz:\s*["']([^"']+)["']/;
    const match1 = html.match(bizPattern);
    if (match1 && match1[1]) {
      biz = match1[1];
    } else {
      const varBizPattern = /var\s+biz\s*=\s*["']([^"']+)["']/;
      const match2 = html.match(varBizPattern);
      if (match2 && match2[1]) {
        biz = match2[1];
      } else {
        const appuinPattern = /appuin\s*:\s*["']([^"']+)["']/;
        const match3 = html.match(appuinPattern);
        if (match3 && match3[1]) {
          biz = match3[1];
        }
      }
    }

    // Use fallback if still not found
    biz = biz || fallbackBiz;

    if (!biz) {
      return c.json<ApiResponse>(
        { success: false, error: 'Could not extract Biz ID from WeChat page HTML.' },
        400
      );
    }

    // Parse name/nickname
    let name = '';
    const nicknamePattern1 = /var\s+nickname\s*=\s*htmlDecode\(["']([^"']+)["']\)/;
    const matchNick1 = html.match(nicknamePattern1);
    if (matchNick1 && matchNick1[1]) {
      name = matchNick1[1];
    } else {
      const nicknamePattern2 = /var\s+nickname\s*=\s*["']([^"']+)["']/;
      const matchNick2 = html.match(nicknamePattern2);
      if (matchNick2 && matchNick2[1]) {
        name = matchNick2[1];
      } else {
        const profileNicknamePattern = /<strong[^>]*class=["']profile_nickname["'][^>]*>\s*([^<\s]+)\s*<\/strong>/;
        const matchNick3 = html.match(profileNicknamePattern);
        if (matchNick3 && matchNick3[1]) {
          name = matchNick3[1];
        }
      }
    }

    // Parse avatarUrl
    let avatarUrl = '';
    const roundHeadPattern1 = /var\s+round_head_img\s*=\s*["']([^"']+)["']/;
    const matchAvatar1 = html.match(roundHeadPattern1);
    if (matchAvatar1 && matchAvatar1[1]) {
      avatarUrl = matchAvatar1[1];
    } else {
      const roundHeadPattern2 = /round_head_img\s*:\s*["']([^"']+)["']/;
      const matchAvatar2 = html.match(roundHeadPattern2);
      if (matchAvatar2 && matchAvatar2[1]) {
        avatarUrl = matchAvatar2[1];
      }
    }

    return c.json({
      success: true,
      data: {
        biz,
        name: name || '微信公众号',
        avatarUrl,
      },
    });
  } catch (err) {
    if (fallbackBiz) {
      return c.json({
        success: true,
        data: { biz: fallbackBiz, name: '微信公众号', avatarUrl: '' }
      });
    }
    return c.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : 'Error fetching WeChat page' },
      500
    );
  }
});

// ============================================================
// POST / — add a new source
// ============================================================
sourcesRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = createSourceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: 'Validation error',
        message: parsed.error.issues.map((i) => i.message).join('; '),
      },
      400
    );
  }

  const db = getDatabase();
  const input = parsed.data;

  // Check for duplicate source
  const existing = db
    .select()
    .from(sources)
    .where(eq(sources.identifier, input.identifier))
    .get();

  if (existing) {
    return c.json<ApiResponse>(
      { success: false, error: `Source with identifier "${input.identifier}" already exists` },
      409
    );
  }

  const newSource: schema.NewSource = {
    id: uuidv4(),
    type: input.type,
    name: input.name,
    identifier: input.identifier,
    avatarUrl: input.avatarUrl,
    description: input.description,
    config: input.config,
    isActive: true,
  };

  db.insert(sources).values(newSource).run();

  const sourceInfo: SourceInfo = {
    id: newSource.id,
    type: newSource.type,
    name: newSource.name,
    identifier: newSource.identifier,
    avatarUrl: newSource.avatarUrl ?? undefined,
    description: newSource.description ?? undefined,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  return c.json<ApiResponse<SourceInfo>>(
    { success: true, data: sourceInfo, message: 'Source added successfully' },
    201
  );
});

// ============================================================
// POST /bulk-import — bulk import sources (currently Twitter)
// ============================================================
sourcesRoutes.post('/bulk-import', async (c) => {
  const body = await c.req.json<{
    type: string;
    identifiers?: string[];
    sources?: Array<{ name: string; identifier: string; description?: string; avatarUrl?: string }>;
  }>();
  const { type, identifiers, sources: inputSources } = body;

  if (type !== 'twitter') {
    return c.json<ApiResponse>({ success: false, error: 'Only twitter bulk import is supported currently' }, 400);
  }

  const db = getDatabase();
  const apiKey = await getTwitterApiKey();
  const results: Array<{ identifier: string; success: boolean; error?: string }> = [];

  // Case A: Import from sources array (e.g. from CSV)
  if (Array.isArray(inputSources) && inputSources.length > 0) {
    for (const item of inputSources) {
      let handle = item.identifier.trim();
      if (handle.startsWith('@')) {
        handle = handle.substring(1);
      }
      if (!handle) continue;

      // Check duplicate
      const existing = db
        .select()
        .from(sources)
        .where(eq(sources.identifier, handle))
        .get();

      if (existing) {
        results.push({ identifier: handle, success: true });
        continue;
      }

      try {
        const newSource: schema.NewSource = {
          id: uuidv4(),
          type: 'twitter',
          name: item.name.trim() || handle,
          identifier: handle,
          avatarUrl: item.avatarUrl?.trim() || null,
          description: item.description?.trim() || null,
          isActive: true,
        };
        db.insert(sources).values(newSource).run();
        results.push({ identifier: handle, success: true });
      } catch (err) {
        results.push({ identifier: handle, success: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  // Case B: Import from identifiers array (e.g. from copy-pasting handles)
  else if (Array.isArray(identifiers) && identifiers.length > 0) {
    for (const rawId of identifiers) {
      let handle = rawId.trim();
      if (handle.startsWith('@')) {
        handle = handle.substring(1);
      }
      if (!handle) continue;

      const existing = db
        .select()
        .from(sources)
        .where(eq(sources.identifier, handle))
        .get();

      if (existing) {
        results.push({ identifier: handle, success: true });
        continue;
      }

      let name = handle;
      let avatarUrl: string | undefined;
      let description: string | undefined;

      if (apiKey) {
        try {
          const response = await fetch(`https://api.twitterapi.io/twitter/user/info?userName=${handle}`, {
            headers: { 'X-API-Key': apiKey },
          });
          if (response.ok) {
            const resData = await response.json() as any;
            const user = resData?.user || resData;
            if (user) {
              name = user.name || handle;
              avatarUrl = user.profilePicture || user.profile_image_url_https || user.avatar;
              description = user.description;
            }
          }
        } catch (err) {
          console.warn(`Failed to lookup profile for ${handle} during bulk import:`, err);
        }
      }

      try {
        const newSource: schema.NewSource = {
          id: uuidv4(),
          type: 'twitter',
          name,
          identifier: handle,
          avatarUrl: avatarUrl ?? null,
          description: description ?? null,
          isActive: true,
        };
        db.insert(sources).values(newSource).run();
        results.push({ identifier: handle, success: true });
      } catch (err) {
        results.push({ identifier: handle, success: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  } else {
    return c.json<ApiResponse>({ success: false, error: 'Either identifiers or sources array must be provided' }, 400);
  }

  return c.json<ApiResponse>({
    success: true,
    data: results,
  });
});

// ============================================================
// GET / — list all sources
// ============================================================
sourcesRoutes.get('/', async (c) => {
  const db = getDatabase();
  const allSources = db.select().from(sources).all();

  // Get article counts per source
  const counts = db
    .select({
      sourceId: articles.sourceId,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(articles)
    .groupBy(articles.sourceId)
    .all();

  const countMap = new Map(counts.map((r) => [r.sourceId, r.count]));

  const result: SourceInfo[] = allSources.map((s) => ({
    id: s.id,
    type: s.type,
    name: s.name,
    identifier: s.identifier,
    avatarUrl: s.avatarUrl ?? undefined,
    description: s.description ?? undefined,
    isActive: s.isActive,
    lastSyncAt: s.lastSyncAt ?? undefined,
    articleCount: countMap.get(s.id) ?? 0,
    tags: s.tags ?? [],
    createdAt: s.createdAt,
  }));

  return c.json<ApiResponse<SourceInfo[]>>({
    success: true,
    data: result,
  });
});

// ============================================================
// DELETE /:id — delete a source
// ============================================================
sourcesRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const db = getDatabase();

  const source = db.select().from(sources).where(eq(sources.id, id)).get();
  if (!source) {
    return c.json<ApiResponse>(
      { success: false, error: 'Source not found' },
      404
    );
  }

  // Cascade delete will remove related articles and AI results
  db.delete(sources).where(eq(sources.id, id)).run();

  return c.json<ApiResponse>({
    success: true,
    message: 'Source deleted successfully',
  });
});

// ============================================================
// PATCH /:id — update a source (name, description, avatarUrl, isActive)
// ============================================================
sourcesRoutes.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  // Validate fields with a partial schema of createSourceSchema
  const parsed = createSourceSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: 'Validation error',
        message: parsed.error.issues.map((i) => i.message).join('; '),
      },
      400
    );
  }

  const db = getDatabase();
  const source = db.select().from(sources).where(eq(sources.id, id)).get();
  
  if (!source) {
    return c.json<ApiResponse>(
      { success: false, error: 'Source not found' },
      404
    );
  }

  const updates = parsed.data;
  const setValues: Record<string, unknown> = {};

  if (updates.name !== undefined) setValues.name = updates.name;
  if (updates.description !== undefined) setValues.description = updates.description;
  if (updates.avatarUrl !== undefined) setValues.avatarUrl = updates.avatarUrl;
  if (updates.config !== undefined) setValues.config = updates.config;
  if (updates.tags !== undefined) setValues.tags = updates.tags;
  
  // Allow toggling isActive directly
  const rawBody = body as { isActive?: boolean };
  if (rawBody.isActive !== undefined) {
    setValues.isActive = rawBody.isActive;
  }

  if (Object.keys(setValues).length > 0) {
    setValues.updatedAt = new Date().toISOString();
    db.update(sources).set(setValues).where(eq(sources.id, id)).run();
  }

  const updatedSource = db.select().from(sources).where(eq(sources.id, id)).get();

  return c.json<ApiResponse<SourceInfo>>({
    success: true,
    data: {
      id: updatedSource!.id,
      type: updatedSource!.type,
      name: updatedSource!.name,
      identifier: updatedSource!.identifier,
      avatarUrl: updatedSource!.avatarUrl ?? undefined,
      description: updatedSource!.description ?? undefined,
      isActive: updatedSource!.isActive,
      lastSyncAt: updatedSource!.lastSyncAt ?? undefined,
      tags: updatedSource!.tags ?? [],
      createdAt: updatedSource!.createdAt,
    },
    message: 'Source updated successfully',
  });
});

// ============================================================
// POST /sync — sync all sources
// ============================================================
sourcesRoutes.post('/sync', async (c) => {
  const db = getDatabase();
  const allSources = db.select().from(sources).where(eq(sources.isActive, true)).all();

  const dajialaApiKey = await getDajialaApiKey();
  const twitterApiKey = await getTwitterApiKey();

  const wechat = dajialaApiKey ? new WechatSource(dajialaApiKey) : null;
  const twitter = twitterApiKey ? new TwitterSource(twitterApiKey) : null;

  let totalNewArticles = 0;
  const syncResults = [];

  for (const source of allSources) {
    let newCount = 0;

    if (source.type === 'wechat') {
      if (!wechat) {
        console.warn(`Skipping WeChat source "${source.name}" sync: API key not configured.`);
        syncResults.push({ id: source.id, name: source.name, newArticles: 0, error: 'API key not configured' });
        continue;
      }

      const isFirstSync = !source.lastSyncAt;
      const pagesToFetch = isFirstSync ? [1, 2, 3] : [1];
      const articlesToInsert: schema.NewArticle[] = [];

      for (const page of pagesToFetch) {
        try {
          const fetchedArticles = await wechat.fetchArticles(source.identifier, page);
          if (fetchedArticles.length === 0) break;

          for (const article of fetchedArticles) {
            const existing = db
              .select({ id: articles.id })
              .from(articles)
              .where(eq(articles.originalUrl, article.url))
              .get();

            if (existing) continue;

            articlesToInsert.push({
              id: uuidv4(),
              sourceId: source.id,
              title: article.title,
              author: article.author ?? null,
              summary: article.digest ?? null,
              originalUrl: article.url,
              coverImageUrl: article.cover ?? null,
              publishedAt: article.ctime,
              fetchedAt: new Date().toISOString(),
              isRead: false,
              isStarred: false,
            });
          }
        } catch (err) {
          console.error(`Error syncing WeChat page ${page} for source ${source.name}:`, err);
          break;
        }
      }

      if (articlesToInsert.length > 0) {
        db.transaction(() => {
          for (const item of articlesToInsert) {
            db.insert(articles).values(item).run();
          }
        });
        newCount += articlesToInsert.length;
      }
    } else if (source.type === 'twitter') {
      if (!twitter) {
        console.warn(`Skipping Twitter source "${source.name}" sync: API key not configured.`);
        syncResults.push({ id: source.id, name: source.name, newArticles: 0, error: 'API key not configured' });
        continue;
      }

      // Automatically fetch and update avatar/bio during sync if missing
      if (!source.avatarUrl && twitterApiKey) {
        try {
          const response = await fetch(`https://api.twitterapi.io/twitter/user/info?userName=${source.identifier}`, {
            headers: { 'X-API-Key': twitterApiKey },
          });
          if (response.ok) {
            const resData = await response.json() as any;
            const user = resData?.user || resData;
            if (user) {
              const avatarUrl = user.profilePicture || user.profile_image_url_https || user.avatar;
              const description = user.description;
              if (avatarUrl) {
                db.update(sources)
                  .set({ avatarUrl, description: description || source.description, updatedAt: new Date().toISOString() })
                  .where(eq(sources.id, source.id))
                  .run();
                source.avatarUrl = avatarUrl;
                if (description) source.description = description;
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to auto-update avatar for source ${source.identifier} during sync:`, e);
        }
      }

      try {
        const fetchedTweets = await twitter.fetchArticles(source.identifier);
        if (fetchedTweets.length > 0) {
          const tweetsToInsert: schema.NewArticle[] = [];
          for (const tweet of fetchedTweets) {
            const existing = db
              .select({ id: articles.id })
              .from(articles)
              .where(eq(articles.originalUrl, tweet.url))
              .get();

            if (existing) continue;

            tweetsToInsert.push({
              id: uuidv4(),
              sourceId: source.id,
              title: tweet.title,
              author: tweet.author ?? null,
              summary: tweet.digest ?? null,
              originalUrl: tweet.url,
              coverImageUrl: tweet.cover ?? null,
              publishedAt: tweet.ctime,
              fetchedAt: new Date().toISOString(),
              isRead: false,
              isStarred: false,
              contentText: tweet.contentText ?? null,
              contentHtml: tweet.contentHtml ?? null,
              likeCount: tweet.likeCount ?? null,
              readCount: tweet.readCount ?? null,
              commentCount: tweet.commentCount ?? null,
            });
          }
          if (tweetsToInsert.length > 0) {
            db.transaction(() => {
              for (const item of tweetsToInsert) {
                db.insert(articles).values(item).run();
              }
            });
            newCount += tweetsToInsert.length;
          }
        }
      } catch (err) {
        console.error(`Error syncing Twitter source ${source.name}:`, err);
      }
    } else if (source.type === 'podcast') {
      try {
        const podcast = new PodcastSource();
        const fetchedEpisodes = await podcast.fetchArticles(source.identifier);
        if (fetchedEpisodes.length > 0) {
          const episodesToInsert: schema.NewArticle[] = [];
          for (const episode of fetchedEpisodes) {
            const existing = db
              .select({ id: articles.id, originalUrl: articles.originalUrl })
              .from(articles)
              .where(
                episode.audioUrl
                  ? or(eq(articles.originalUrl, episode.url), eq(articles.audioUrl, episode.audioUrl))
                  : eq(articles.originalUrl, episode.url)
              )
              .get();

            if (existing) {
              if (episode.audioUrl && existing.originalUrl === episode.audioUrl && episode.url !== episode.audioUrl) {
                db.update(articles)
                  .set({ originalUrl: episode.url })
                  .where(eq(articles.id, existing.id))
                  .run();
              }
              continue;
            }

            episodesToInsert.push({
              id: uuidv4(),
              sourceId: source.id,
              title: episode.title,
              author: episode.author ?? null,
              summary: episode.digest ?? null,
              originalUrl: episode.url,
              coverImageUrl: episode.cover ?? null,
              publishedAt: episode.ctime,
              fetchedAt: new Date().toISOString(),
              isRead: false,
              isStarred: false,
              contentText: episode.contentText ?? null,
              contentHtml: episode.contentHtml ?? null,
              audioUrl: episode.audioUrl ?? null,
              duration: episode.duration ?? null,
            });
          }
          if (episodesToInsert.length > 0) {
            db.transaction(() => {
              for (const item of episodesToInsert) {
                db.insert(articles).values(item).run();
              }
            });
            newCount += episodesToInsert.length;
          }
        }
      } catch (err) {
        console.error(`Error syncing Podcast source ${source.name}:`, err);
      }
    } else {
      continue;
    }

    db.update(sources)
      .set({
        lastSyncAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sources.id, source.id))
      .run();

    totalNewArticles += newCount;
    syncResults.push({ id: source.id, name: source.name, newArticles: newCount });
  }

  return c.json<ApiResponse<{ newArticles: number; details: typeof syncResults }>>({
    success: true,
    data: { newArticles: totalNewArticles, details: syncResults },
    message: `Successfully synced all sources. Found ${totalNewArticles} new articles.`,
  });
});

// ============================================================
// POST /:id/sync — sync articles from a source
// ============================================================
sourcesRoutes.post('/:id/sync', async (c) => {
  const { id } = c.req.param();
  const db = getDatabase();

  const source = db.select().from(sources).where(eq(sources.id, id)).get();
  if (!source) {
    return c.json<ApiResponse>(
      { success: false, error: 'Source not found' },
      404
    );
  }

  if (source.type !== 'wechat' && source.type !== 'twitter' && source.type !== 'podcast') {
    return c.json<ApiResponse>(
      { success: false, error: `Sync for source type "${source.type}" is not supported yet` },
      400
    );
  }

  let newCount = 0;
  let totalFetched = 0;

  if (source.type === 'wechat') {
    const apiKey = await getDajialaApiKey();
    if (!apiKey) {
      return c.json<ApiResponse>(
        { success: false, error: 'WeChat API key (dajialaApiKey) is not configured.' },
        400
      );
    }

    const wechat = new WechatSource(apiKey);
    const isFirstSync = !source.lastSyncAt;
    const pagesToFetch = isFirstSync ? [1, 2, 3] : [1];
    const articlesToInsert: schema.NewArticle[] = [];

    for (const page of pagesToFetch) {
      try {
        const fetchedArticles = await wechat.fetchArticles(source.identifier, page);
        totalFetched += fetchedArticles.length;
        if (fetchedArticles.length === 0) break;

        for (const article of fetchedArticles) {
          const existing = db
            .select({ id: articles.id })
            .from(articles)
            .where(eq(articles.originalUrl, article.url))
            .get();

          if (existing) continue;

          articlesToInsert.push({
            id: uuidv4(),
            sourceId: source.id,
            title: article.title,
            author: article.author ?? null,
            summary: article.digest ?? null,
            originalUrl: article.url,
            coverImageUrl: article.cover ?? null,
            publishedAt: article.ctime,
            fetchedAt: new Date().toISOString(),
            isRead: false,
            isStarred: false,
          });
        }
      } catch (err) {
        console.error(`Error syncing WeChat page ${page} for source ${source.name}:`, err);
        if (page === 1) throw err;
        break;
      }
    }

    if (articlesToInsert.length > 0) {
      db.transaction(() => {
        for (const item of articlesToInsert) {
          db.insert(articles).values(item).run();
        }
      });
      newCount += articlesToInsert.length;
    }
  } else if (source.type === 'twitter') {
    const apiKey = await getTwitterApiKey();
    if (!apiKey) {
      return c.json<ApiResponse>(
        { success: false, error: 'Twitter API key (twitterApiKey) is not configured.' },
        400
      );
    }

    const twitter = new TwitterSource(apiKey);

    // Automatically fetch and update avatar/bio during sync if missing
    if (!source.avatarUrl) {
      try {
        const response = await fetch(`https://api.twitterapi.io/twitter/user/info?userName=${source.identifier}`, {
          headers: { 'X-API-Key': apiKey },
        });
        if (response.ok) {
          const resData = await response.json() as any;
          const user = resData?.user || resData;
          if (user) {
            const avatarUrl = user.profilePicture || user.profile_image_url_https || user.avatar;
            const description = user.description;
            if (avatarUrl) {
              db.update(sources)
                .set({ avatarUrl, description: description || source.description, updatedAt: new Date().toISOString() })
                .where(eq(sources.id, source.id))
                .run();
              source.avatarUrl = avatarUrl;
              if (description) source.description = description;
            }
          }
        }
      } catch (e) {
        console.warn(`Failed to auto-update avatar for source ${source.identifier} during sync:`, e);
      }
    }

    try {
      const fetchedTweets = await twitter.fetchArticles(source.identifier);
      totalFetched = fetchedTweets.length;
      const tweetsToInsert: schema.NewArticle[] = [];

      for (const tweet of fetchedTweets) {
        const existing = db
          .select({ id: articles.id })
          .from(articles)
          .where(eq(articles.originalUrl, tweet.url))
          .get();

        if (existing) continue;

        tweetsToInsert.push({
          id: uuidv4(),
          sourceId: source.id,
          title: tweet.title,
          author: tweet.author ?? null,
          summary: tweet.digest ?? null,
          originalUrl: tweet.url,
          coverImageUrl: tweet.cover ?? null,
          publishedAt: tweet.ctime,
          fetchedAt: new Date().toISOString(),
          isRead: false,
          isStarred: false,
          contentText: tweet.contentText ?? null,
          contentHtml: tweet.contentHtml ?? null,
          likeCount: tweet.likeCount ?? null,
          readCount: tweet.readCount ?? null,
          commentCount: tweet.commentCount ?? null,
        });
      }

      if (tweetsToInsert.length > 0) {
        db.transaction(() => {
          for (const item of tweetsToInsert) {
            db.insert(articles).values(item).run();
          }
        });
        newCount += tweetsToInsert.length;
      }
    } catch (err) {
      console.error(`Error syncing Twitter source ${source.name}:`, err);
      throw err;
    }
  } else if (source.type === 'podcast') {
    try {
      const podcast = new PodcastSource();
      const fetchedEpisodes = await podcast.fetchArticles(source.identifier);
      totalFetched = fetchedEpisodes.length;
      const episodesToInsert: schema.NewArticle[] = [];

      for (const episode of fetchedEpisodes) {
        const existing = db
          .select({ id: articles.id, originalUrl: articles.originalUrl })
          .from(articles)
          .where(
            episode.audioUrl
              ? or(eq(articles.originalUrl, episode.url), eq(articles.audioUrl, episode.audioUrl))
              : eq(articles.originalUrl, episode.url)
          )
          .get();

        if (existing) {
          if (episode.audioUrl && existing.originalUrl === episode.audioUrl && episode.url !== episode.audioUrl) {
            db.update(articles)
              .set({ originalUrl: episode.url })
              .where(eq(articles.id, existing.id))
              .run();
          }
          continue;
        }

        episodesToInsert.push({
          id: uuidv4(),
          sourceId: source.id,
          title: episode.title,
          author: episode.author ?? null,
          summary: episode.digest ?? null,
          originalUrl: episode.url,
          coverImageUrl: episode.cover ?? null,
          publishedAt: episode.ctime,
          fetchedAt: new Date().toISOString(),
          isRead: false,
          isStarred: false,
          contentText: episode.contentText ?? null,
          contentHtml: episode.contentHtml ?? null,
          audioUrl: episode.audioUrl ?? null,
          duration: episode.duration ?? null,
        });
      }

      if (episodesToInsert.length > 0) {
        db.transaction(() => {
          for (const item of episodesToInsert) {
            db.insert(articles).values(item).run();
          }
        });
        newCount += episodesToInsert.length;
      }
    } catch (err) {
      console.error(`Error syncing Podcast source ${source.name}:`, err);
      throw err;
    }
  }

  // Update lastSyncAt on the source
  db.update(sources)
    .set({
      lastSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(sources.id, id))
    .run();

  return c.json<ApiResponse<{ synced: number; total: number }>>({
    success: true,
    data: { synced: newCount, total: totalFetched },
    message: `Synced ${newCount} new articles out of ${totalFetched} fetched`,
  });
});

// ============================================================
// POST /bulk-update-tags — bulk update tags for sources
// ============================================================
sourcesRoutes.post('/bulk-update-tags', async (c) => {
  const body = await c.req.json<{ ids: string[]; tags: string[]; action: 'append' | 'overwrite' }>();
  const { ids, tags, action } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json<ApiResponse>(
      { success: false, error: 'Parameter "ids" must be a non-empty array' },
      400
    );
  }

  if (!Array.isArray(tags)) {
    return c.json<ApiResponse>(
      { success: false, error: 'Parameter "tags" must be an array' },
      400
    );
  }

  if (action !== 'append' && action !== 'overwrite') {
    return c.json<ApiResponse>(
      { success: false, error: 'Parameter "action" must be either "append" or "overwrite"' },
      400
    );
  }

  const db = getDatabase();

  try {
    db.transaction(() => {
      for (const id of ids) {
        const source = db.select().from(sources).where(eq(sources.id, id)).get();
        if (!source) continue;

        let newTags: string[] = [];
        if (action === 'overwrite') {
          newTags = tags;
        } else {
          // append
          const existingTags = source.tags || [];
          newTags = Array.from(new Set([...existingTags, ...tags]));
        }

        db.update(sources)
          .set({
            tags: newTags,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(sources.id, id))
          .run();
      }
    });

    return c.json<ApiResponse>({
      success: true,
      message: 'Tags updated successfully for selected sources',
    });
  } catch (err) {
    return c.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});

// ============================================================
// POST /bulk-delete — bulk delete sources
// ============================================================
sourcesRoutes.post('/bulk-delete', async (c) => {
  const body = await c.req.json<{ ids: string[] }>();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json<ApiResponse>(
      { success: false, error: 'Parameter "ids" must be a non-empty array' },
      400
    );
  }

  const db = getDatabase();

  try {
    db.delete(sources).where(inArray(sources.id, ids)).run();

    return c.json<ApiResponse>({
      success: true,
      message: 'Sources deleted successfully',
    });
  } catch (err) {
    return c.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});

