import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@knowflow/db';
import { schema } from '@knowflow/db';
import { eq, sql } from 'drizzle-orm';
import {
  createSourceSchema,
  type ApiResponse,
  type SourceInfo,
  type WechatAccountSearchResult,
} from '@knowflow/shared';
import { WechatSource } from '../services/sources/wechat.js';
import { getDajialaApiKey } from '../services/settings.js';

const { sources, articles } = schema;

export const sourcesRoutes = new Hono();

// ============================================================
// POST /search — search for WeChat accounts
// ============================================================
sourcesRoutes.post('/search', async (c) => {
  const body = await c.req.json<{ query: string; type?: string }>();
  const { query, type = 'wechat' } = body;

  if (!query || query.trim().length === 0) {
    return c.json<ApiResponse>(
      { success: false, error: 'Search query is required' },
      400
    );
  }

  if (type !== 'wechat') {
    return c.json<ApiResponse>(
      { success: false, error: `Source type "${type}" is not supported yet` },
      400
    );
  }

  const apiKey = await getDajialaApiKey();
  if (!apiKey) {
    return c.json<ApiResponse>(
      { success: false, error: 'WeChat API key (dajialaApiKey) is not configured. Please set it in Settings.' },
      400
    );
  }

  const wechat = new WechatSource(apiKey);
  const results = await wechat.search(query);

  return c.json<ApiResponse<WechatAccountSearchResult[]>>({
    success: true,
    data: results,
  });
});

// ============================================================
// GET /wechat/search — search for WeChat accounts (frontend GET version)
// ============================================================
sourcesRoutes.get('/wechat/search', async (c) => {
  const query = c.req.query('q');

  if (!query || query.trim().length === 0) {
    return c.json<ApiResponse>(
      { success: false, error: 'Search query parameter "q" is required' },
      400
    );
  }

  const apiKey = await getDajialaApiKey();
  if (!apiKey) {
    return c.json<ApiResponse>(
      { success: false, error: 'WeChat API key (dajialaApiKey) is not configured. Please set it in Settings.' },
      400
    );
  }

  const wechat = new WechatSource(apiKey);
  const results = await wechat.search(query);

  return c.json<ApiResponse<WechatAccountSearchResult[]>>({
    success: true,
    data: results,
  });
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

  // 1. Try to extract directly from query params first
  try {
    const parsedUrl = new URL(url);
    const biz = parsedUrl.searchParams.get('__biz');
    if (biz) {
      return c.json({ success: true, data: { biz } });
    }
  } catch (e) {
    // Ignore URL parse error and fall back to fetching
  }

  // Double check in-text matching: __biz=xxx (in case URL parser missed it)
  const regexBiz = /__biz=([^&"'\s#]+)/;
  const matchBiz = url.match(regexBiz);
  if (matchBiz && matchBiz[1]) {
    return c.json({ success: true, data: { biz: matchBiz[1] } });
  }

  // 2. Fetch page and parse
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return c.json<ApiResponse>(
        { success: false, error: `Failed to fetch WeChat page: ${response.statusText}` },
        400
      );
    }

    const html = await response.text();
    
    // Pattern matches
    const bizPattern = /biz:\s*["']([^"']+)["']/;
    const match1 = html.match(bizPattern);
    if (match1 && match1[1]) {
      return c.json({ success: true, data: { biz: match1[1] } });
    }

    const varBizPattern = /var\s+biz\s*=\s*["']([^"']+)["']/;
    const match2 = html.match(varBizPattern);
    if (match2 && match2[1]) {
      return c.json({ success: true, data: { biz: match2[1] } });
    }

    const appuinPattern = /appuin\s*:\s*["']([^"']+)["']/;
    const match3 = html.match(appuinPattern);
    if (match3 && match3[1]) {
      return c.json({ success: true, data: { biz: match3[1] } });
    }

    const queryBizPattern = /__biz=([^&"'\s#]+)/;
    const match4 = html.match(queryBizPattern);
    if (match4 && match4[1]) {
      return c.json({ success: true, data: { biz: match4[1] } });
    }

    return c.json<ApiResponse>(
      { success: false, error: 'Could not extract Biz ID from WeChat page HTML.' },
      400
    );
  } catch (err) {
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

  const apiKey = await getDajialaApiKey();
  if (!apiKey) {
    return c.json<ApiResponse>(
      { success: false, error: 'WeChat API key (dajialaApiKey) is not configured.' },
      400
    );
  }

  const wechat = new WechatSource(apiKey);
  let totalNewArticles = 0;
  const syncResults = [];

  for (const source of allSources) {
    if (source.type !== 'wechat') continue;

    const isFirstSync = !source.lastSyncAt;
    const pagesToFetch = isFirstSync ? [1, 2, 3] : [1];
    let newCount = 0;

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

          const newArticle: schema.NewArticle = {
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
          };

          db.insert(articles).values(newArticle).run();
          newCount++;
        }
      } catch (err) {
        console.error(`Error syncing page ${page} for source ${source.name}:`, err);
        break;
      }
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

  if (source.type !== 'wechat') {
    return c.json<ApiResponse>(
      { success: false, error: `Sync for source type "${source.type}" is not supported yet` },
      400
    );
  }

  const apiKey = await getDajialaApiKey();
  if (!apiKey) {
    return c.json<ApiResponse>(
      { success: false, error: 'WeChat API key (dajialaApiKey) is not configured.' },
      400
    );
  }

  const wechat = new WechatSource(apiKey);

  // Scheme A: Fetch 3 pages on first sync (lastSyncAt is null), 1 page on subsequent syncs
  const isFirstSync = !source.lastSyncAt;
  const pagesToFetch = isFirstSync ? [1, 2, 3] : [1];

  let newCount = 0;
  let totalFetched = 0;

  for (const page of pagesToFetch) {
    try {
      const fetchedArticles = await wechat.fetchArticles(source.identifier, page);
      totalFetched += fetchedArticles.length;
      if (fetchedArticles.length === 0) break; // No more articles available

      for (const article of fetchedArticles) {
        // Skip if article with same URL already exists
        const existing = db
          .select({ id: articles.id })
          .from(articles)
          .where(eq(articles.originalUrl, article.url))
          .get();

        if (existing) continue;

        const newArticle: schema.NewArticle = {
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
        };

        db.insert(articles).values(newArticle).run();
        newCount++;
      }
    } catch (err) {
      console.error(`Error syncing page ${page} for source ${source.name}:`, err);
      // If the first page fails, we fail the request. If subsequent pages fail, we just stop.
      if (page === 1) throw err;
      break;
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
