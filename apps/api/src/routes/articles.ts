import { Hono } from 'hono';
import { getDatabase } from '@knowflow/db';
import { schema } from '@knowflow/db';
import { eq, and, like, sql, desc, asc } from 'drizzle-orm';
import {
  articleFilterSchema,
  updateArticleSchema,
  type ApiResponse,
  type ArticleInfo,
  type PaginatedResponse,
} from '@knowflow/shared';
import { WechatSource } from '../services/sources/wechat.js';
import { getDajialaApiKey } from '../services/settings.js';

const { articles, sources } = schema;

export const articlesRoutes = new Hono();

// ============================================================
// GET / — list articles (paginated, filterable)
// ============================================================
articlesRoutes.get('/', async (c) => {
  const query = c.req.query();

  // Parse and validate query params
  const parsed = articleFilterSchema.safeParse({
    sourceId: query.sourceId,
    isRead: query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined,
    isStarred: query.isStarred === 'true' ? true : query.isStarred === 'false' ? false : undefined,
    search: query.search,
    page: query.page ? parseInt(query.page, 10) : undefined,
    pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
    sortBy: query.sortBy as 'publishedAt' | 'readCount' | 'createdAt' | undefined,
    sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
  });

  if (!parsed.success) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: 'Invalid query parameters',
        message: parsed.error.issues.map((i) => i.message).join('; '),
      },
      400
    );
  }

  const filters = parsed.data;
  const db = getDatabase();

  // Build WHERE conditions
  const conditions = [];
  if (filters.sourceId) {
    conditions.push(eq(articles.sourceId, filters.sourceId));
  }
  if (filters.isRead !== undefined) {
    conditions.push(eq(articles.isRead, filters.isRead));
  }
  if (filters.isStarred !== undefined) {
    conditions.push(eq(articles.isStarred, filters.isStarred));
  }
  if (filters.search) {
    conditions.push(like(articles.title, `%${filters.search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count total
  const countResult = db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
    .where(whereClause)
    .get();
  const total = countResult?.count ?? 0;

  // Sort
  const sortColumn =
    filters.sortBy === 'readCount'
      ? articles.readCount
      : filters.sortBy === 'createdAt'
        ? articles.createdAt
        : articles.publishedAt;

  const orderFn = filters.sortOrder === 'asc' ? asc : desc;

  // Query with pagination and join to sources for sourceName
  const offset = (filters.page - 1) * filters.pageSize;

  const rows = db
    .select({
      id: articles.id,
      sourceId: articles.sourceId,
      sourceName: sources.name,
      sourceType: sources.type,
      title: articles.title,
      author: articles.author,
      summary: articles.summary,
      originalUrl: articles.originalUrl,
      coverImageUrl: articles.coverImageUrl,
      readCount: articles.readCount,
      likeCount: articles.likeCount,
      commentCount: articles.commentCount,
      isRead: articles.isRead,
      isStarred: articles.isStarred,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
    })
    .from(articles)
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .where(whereClause)
    .orderBy(orderFn(sortColumn))
    .limit(filters.pageSize)
    .offset(offset)
    .all();

  const items: ArticleInfo[] = rows.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    sourceName: row.sourceName ?? undefined,
    sourceType: row.sourceType ?? undefined,
    title: row.title,
    author: row.author ?? undefined,
    summary: row.summary ?? undefined,
    originalUrl: row.originalUrl ?? undefined,
    coverImageUrl: row.coverImageUrl ?? undefined,
    readCount: row.readCount ?? undefined,
    likeCount: row.likeCount ?? undefined,
    commentCount: row.commentCount ?? undefined,
    isRead: row.isRead,
    isStarred: row.isStarred,
    publishedAt: row.publishedAt ?? undefined,
    createdAt: row.createdAt,
  }));

  const paginated: PaginatedResponse<ArticleInfo> = {
    items,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.ceil(total / filters.pageSize),
  };

  return c.json<ApiResponse<PaginatedResponse<ArticleInfo>>>({
    success: true,
    data: paginated,
  });
});

// ============================================================
// GET /:id — get article detail (with full HTML content)
// ============================================================
articlesRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const db = getDatabase();

  const row = db
    .select({
      id: articles.id,
      sourceId: articles.sourceId,
      sourceName: sources.name,
      sourceType: sources.type,
      title: articles.title,
      author: articles.author,
      summary: articles.summary,
      contentText: articles.contentText,
      contentHtml: articles.contentHtml,
      originalUrl: articles.originalUrl,
      coverImageUrl: articles.coverImageUrl,
      readCount: articles.readCount,
      likeCount: articles.likeCount,
      commentCount: articles.commentCount,
      isRead: articles.isRead,
      isStarred: articles.isStarred,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      sourceIdentifier: sources.identifier,
    })
    .from(articles)
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .where(eq(articles.id, id))
    .get();

  if (!row) {
    return c.json<ApiResponse>(
      { success: false, error: 'Article not found' },
      404
    );
  }

  // If content is not yet fetched, try to fetch it now
  let contentHtml = row.contentHtml;
  let contentText = row.contentText;
  let readCount = row.readCount;
  let likeCount = row.likeCount;

  if (!contentHtml && row.originalUrl && row.sourceType === 'wechat') {
    try {
      const apiKey = await getDajialaApiKey();
      if (apiKey) {
        const wechat = new WechatSource(apiKey);
        const content = await wechat.fetchArticleContent(row.originalUrl);

        contentHtml = content.html;
        contentText = content.text;
        readCount = content.readCount ?? readCount;
        likeCount = content.likeCount ?? likeCount;

        // Save to DB for future access
        db.update(articles)
          .set({
            contentHtml,
            contentText,
            readCount,
            likeCount,
          })
          .where(eq(articles.id, id))
          .run();
      }
    } catch (err) {
      console.error(`Failed to fetch article content for ${id}:`, err);
      // Continue with empty content — don't fail the request
    }
  }

  const article: ArticleInfo = {
    id: row.id,
    sourceId: row.sourceId,
    sourceName: row.sourceName ?? undefined,
    sourceType: row.sourceType ?? undefined,
    title: row.title,
    author: row.author ?? undefined,
    summary: row.summary ?? undefined,
    contentText: contentText ?? undefined,
    contentHtml: contentHtml ?? undefined,
    originalUrl: row.originalUrl ?? undefined,
    coverImageUrl: row.coverImageUrl ?? undefined,
    readCount: readCount ?? undefined,
    likeCount: likeCount ?? undefined,
    commentCount: row.commentCount ?? undefined,
    isRead: row.isRead,
    isStarred: row.isStarred,
    publishedAt: row.publishedAt ?? undefined,
    createdAt: row.createdAt,
  };

  return c.json<ApiResponse<ArticleInfo>>({
    success: true,
    data: article,
  });
});

// ============================================================
// PATCH /:id — update article (mark read/starred)
// ============================================================
articlesRoutes.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  const parsed = updateArticleSchema.safeParse(body);
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
  const existing = db.select().from(articles).where(eq(articles.id, id)).get();

  if (!existing) {
    return c.json<ApiResponse>(
      { success: false, error: 'Article not found' },
      404
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.isRead !== undefined) {
    updates.isRead = parsed.data.isRead;
  }
  if (parsed.data.isStarred !== undefined) {
    updates.isStarred = parsed.data.isStarred;
  }

  if (Object.keys(updates).length > 0) {
    db.update(articles)
      .set(updates)
      .where(eq(articles.id, id))
      .run();
  }

  // Return updated article
  const updated = db.select().from(articles).where(eq(articles.id, id)).get()!;

  return c.json<ApiResponse<ArticleInfo>>({
    success: true,
    data: {
      id: updated.id,
      sourceId: updated.sourceId,
      title: updated.title,
      author: updated.author ?? undefined,
      summary: updated.summary ?? undefined,
      originalUrl: updated.originalUrl ?? undefined,
      coverImageUrl: updated.coverImageUrl ?? undefined,
      readCount: updated.readCount ?? undefined,
      likeCount: updated.likeCount ?? undefined,
      isRead: updated.isRead,
      isStarred: updated.isStarred,
      publishedAt: updated.publishedAt ?? undefined,
      createdAt: updated.createdAt,
    },
    message: 'Article updated successfully',
  });
});
