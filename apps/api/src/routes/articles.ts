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
import { getDajialaApiKey, loadSettings, getProviderConfig } from '../services/settings.js';
import { getModel, getModelSettings } from '@knowflow/ai';
import { generateText } from 'ai';
import { appendFileSync } from 'fs';
import { join } from 'path';

const { articles, sources } = schema;

export const articlesRoutes = new Hono();

const fetchingArticleIds = new Set<string>();
const failedFetchCount = new Map<string, number>();

// ============================================================
// GET / — list articles (paginated, filterable)
// ============================================================
articlesRoutes.get('/', async (c) => {
  const query = c.req.query();

  // Parse and validate query params
  const parsed = articleFilterSchema.safeParse({
    sourceId: query.sourceId,
    tag: query.tag,
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
  if (filters.tag) {
    conditions.push(sql`exists (select 1 from json_each(${sources.tags}) where json_each.value = ${filters.tag})`);
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
    .leftJoin(sources, eq(articles.sourceId, sources.id))
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
      audioUrl: articles.audioUrl,
      duration: articles.duration,
      transcriptText: articles.transcriptText,
      transcriptHtml: articles.transcriptHtml,
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
    audioUrl: row.audioUrl ?? undefined,
    duration: row.duration ?? undefined,
    transcriptText: row.transcriptText ?? undefined,
    transcriptHtml: row.transcriptHtml ?? undefined,
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
      audioUrl: articles.audioUrl,
      duration: articles.duration,
      transcriptText: articles.transcriptText,
      transcriptHtml: articles.transcriptHtml,
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

  if ((row.contentHtml === null || row.contentText === null) && row.originalUrl && row.sourceType === 'wechat') {
    const attempts = failedFetchCount.get(id) || 0;
    if (attempts < 3 && !fetchingArticleIds.has(id)) {
      fetchingArticleIds.add(id);

      // Start non-blocking background fetch
      (async () => {
        try {
          const apiKey = await getDajialaApiKey();
          if (apiKey && row.originalUrl) {
            const wechat = new WechatSource(apiKey);
            const content = await wechat.fetchArticleContent(row.originalUrl);

            // Save to DB for future access
            db.update(articles)
              .set({
                contentHtml: content.html,
                contentText: content.text,
                readCount: content.readCount ?? row.readCount,
                likeCount: content.likeCount ?? row.likeCount,
              })
              .where(eq(articles.id, id))
              .run();

            failedFetchCount.delete(id);
          }
        } catch (err) {
          console.error(`Failed to fetch article content for ${id} in background:`, err);
          const currentAttempts = failedFetchCount.get(id) || 0;
          const nextAttempts = currentAttempts + 1;
          failedFetchCount.set(id, nextAttempts);

          if (nextAttempts >= 3) {
            // Write empty content to DB to stop infinite polling
            db.update(articles)
              .set({
                contentHtml: '',
                contentText: '',
              })
              .where(eq(articles.id, id))
              .run();
            failedFetchCount.delete(id);
          }
        } finally {
          fetchingArticleIds.delete(id);
        }
      })();
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
    audioUrl: row.audioUrl ?? undefined,
    duration: row.duration ?? undefined,
    transcriptText: row.transcriptText ?? undefined,
    transcriptHtml: row.transcriptHtml ?? undefined,
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
      audioUrl: updated.audioUrl ?? undefined,
      duration: updated.duration ?? undefined,
    },
    message: 'Article updated successfully',
  });
});

// ============================================================
// POST /:id/transcribe — transcribe podcast audio
// ============================================================
articlesRoutes.post('/:id/transcribe', async (c) => {
  const { id } = c.req.param();
  const db = getDatabase();

  const row = db
    .select({
      id: articles.id,
      title: articles.title,
      summary: articles.summary,
      contentText: articles.contentText,
      contentHtml: articles.contentHtml,
      audioUrl: articles.audioUrl,
      duration: articles.duration,
      sourceType: sources.type,
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

  if (row.sourceType !== 'podcast') {
    return c.json<ApiResponse>(
      { success: false, error: 'Only podcast episodes can be transcribed' },
      400
    );
  }

  if (!row.audioUrl) {
    return c.json<ApiResponse>(
      { success: false, error: 'Audio URL is missing for this episode' },
      400
    );
  }

  try {
    const settings = await loadSettings();
    const dashscopeApiKey = settings.dashscopeApiKey || '';

    const { transcribePodcast } = await import('../services/podcast-transcription.js');
    const result = await transcribePodcast(
      row.audioUrl,
      '', // openaiApiKey removed
      row.title,
      row.contentHtml || row.contentText || row.summary || '',
      row.duration ?? undefined,
      '', // openaiApiBaseUrl removed
      dashscopeApiKey
    );

    // Save to DB
    db.update(articles)
      .set({
        transcriptText: result.text,
        transcriptHtml: result.html,
      })
      .where(eq(articles.id, id))
      .run();

    return c.json<ApiResponse<{ transcriptText: string; transcriptHtml: string }>>({
      success: true,
      data: {
        transcriptText: result.text,
        transcriptHtml: result.html,
      },
      message: 'Transcription completed successfully',
    });
  } catch (err) {
    return c.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});

// ============================================================
// POST /:id/identify-speakers — identify speaker names in podcast transcript
// ============================================================
articlesRoutes.post('/:id/identify-speakers', async (c) => {
  const { id } = c.req.param();
  const db = getDatabase();

  const article = db
    .select({
      id: articles.id,
      title: articles.title,
      author: articles.author,
      contentText: articles.contentText,
      transcriptText: articles.transcriptText,
      transcriptHtml: articles.transcriptHtml,
    })
    .from(articles)
    .where(eq(articles.id, id))
    .get();

  if (!article) {
    return c.json<ApiResponse>(
      { success: false, error: 'Article not found' },
      404
    );
  }

  if (!article.transcriptText || !article.transcriptHtml) {
    return c.json<ApiResponse>(
      { success: false, error: '逐字稿为空，请先转录/解析音频' },
      400
    );
  }

  // 1. Extract unique speaker names from transcriptText
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
  if (speakers.length === 0) {
    return c.json<ApiResponse>(
      { success: false, error: '未在逐字稿中提取到发言人标签' },
      400
    );
  }

  const mapping: Record<string, string> = {};
  
  // If article has an author and "主持人" is in the speakers list, pre-map it directly
  if (article.author && article.author.trim().length > 0 && speakers.includes('主持人')) {
    mapping['主持人'] = article.author.trim();
  }

  // Filter out already mapped speakers (like "主持人") from the list to send to AI
  const speakersToIdentify = speakers.filter(s => !mapping[s]);

  try {
    if (speakersToIdentify.length > 0) {
      // 2. Call AI to match remaining speakers
      const settings = await loadSettings();
      const providerConfig = await getProviderConfig();
      const model = settings.defaultAIModel || 'deepseek-chat';
      const aiModel = getModel(model, providerConfig);
 
      const systemPrompt = `你是一个音频内容分析专家。请根据提供的播客单集简介（Shownotes）、创作者/作者、标题以及部分逐字稿文本，分析并找出该播客中每个发言人（如 "主持人", "嘉宾", "嘉宾 A", "发言人 1", "发言人 2" 等）对应的真实姓名或称呼。
请输出一个 JSON 格式的对象，映射原有的发言人标签到匹配到的真实姓名，例如：
{
  "主持人": "李四",
  "嘉宾": "王五"
}
 
重要推理规则（有助于精准判断谁是谁）：
1. 【首要线索 - 自我介绍】：仔细阅读逐字稿的前几十行，寻找类似 "我是XX"、"我是主持人XX"、"今天请到了XX"、"欢迎XX" 这样的自我介绍或欢迎词。如果 "发言人 1" 说 "大家好我是孟岩"，那么 "发言人 1" 就是 "孟岩"。
2. 【次要线索 - 人称呼应】：在对话中，人们经常会称呼对方的名字（例如，发言人 A 说 "继刚你怎么看？"，接着发言人 B 回答。这说明发言人 B 是 "李继刚" / "继刚"）。请根据这些呼应关系来识别身份。
3. 【角色特征】：主持人通常发言较早，负责开场介绍、向嘉宾提问、控制节奏、以及最后的收尾总结；嘉宾通常回答问题，发言段落较长。
4. 【信息核对】：核对播客标题中的名字（如 "孟岩对话李继刚"）以及创作者/作者姓名，把待识别的发言人与这些真实姓名进行匹配。
 
约束：
1. 只能返回合法的 JSON 对象，不要包含任何 markdown 代码块标记（如 \`\`\`json）或其它文字说明。
2. 如果某个发言人无法通过上下文确定真实姓名，请保留原名（即映射关系为 "发言人 1": "发言人 1"）。
3. 真实姓名要精炼，优先使用人名，若无法获取则根据上下文使用合理的称呼。`;
 
      const transcriptSample = lines.slice(0, 150).join('\n');
      const mappedContext = Object.keys(mapping).length > 0 
        ? `已知匹配关系（由本地规则自动推断，无需修改此项）：\n${JSON.stringify(mapping)}\n`
        : '';
 
      const userPrompt = `播客单集标题：${article.title}
节目介绍（Shownotes）：
${article.contentText || '无介绍'}
 
主创作者/主播：${article.author || '未知'}
 
${mappedContext}
待识别的发言人列表：
${JSON.stringify(speakersToIdentify)}
 
逐字稿片段样例：
${transcriptSample}
 
请输出发言人映射 JSON：`;
 
      const { text } = await generateText({
        model: aiModel,
        system: systemPrompt,
        prompt: userPrompt,
        ...getModelSettings(model),
      });
 
      // Parse AI output mapping
      let aiMapping: Record<string, string> = {};
      try {
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        aiMapping = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.error('Failed to parse AI speaker mapping response:', text);
        return c.json<ApiResponse>(
          { success: false, error: 'AI 识别输出格式错误，未能成功解析映射表。' },
          500
        );
      }
 
      // Merge AI mapping into the main mapping
      Object.assign(mapping, aiMapping);
 
      // Log the AI response and mappings
      if (process.env.KNOWFLOW_DEBUG === 'true') {
        const logPath = join(process.cwd(), 'debug_identify.log');
        try {
          const logMsg = `[Debug Identify Speakers]\n` +
            `Article ID: ${id}\n` +
            `Article Title: ${article.title}\n` +
            `Article Author: ${article.author}\n` +
            `All Speakers in Transcript: ${JSON.stringify(speakers)}\n` +
            `Speakers to Identify: ${JSON.stringify(speakersToIdentify)}\n` +
            `AI Text Response: ${text}\n` +
            `Final Mapping Table: ${JSON.stringify(mapping)}\n\n`;
          appendFileSync(logPath, logMsg, 'utf8');
        } catch (e) {
          console.error('Failed to write debug log:', e);
        }
      }
    }
 
    return c.json<ApiResponse<{ mapping: Record<string, string>; speakers: string[] }>>({
      success: true,
      data: {
        mapping,
        speakers,
      },
      message: 'AI 识别发言人姓名推荐完毕。',
    });
  } catch (err) {
    console.error('Speaker identification error:', err);
    return c.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : '识别发言人失败' },
      500
    );
  }
});
 
// POST /:id/apply-speaker-mapping — apply speaker name mapping to transcript
articlesRoutes.post('/:id/apply-speaker-mapping', async (c) => {
  const { id } = c.req.param();
  const db = getDatabase();
 
  const article = db
    .select({
      id: articles.id,
      transcriptText: articles.transcriptText,
      transcriptHtml: articles.transcriptHtml,
    })
    .from(articles)
    .where(eq(articles.id, id))
    .get();
 
  if (!article || !article.transcriptText || !article.transcriptHtml) {
    return c.json<ApiResponse>(
      { success: false, error: '逐字稿为空或文章不存在' },
      404
    );
  }
 
  const { mapping } = (await c.req.json().catch(() => ({ mapping: {} }))) as { mapping: Record<string, string> };
  if (!mapping || typeof mapping !== 'object') {
    return c.json<ApiResponse>(
      { success: false, error: '无效的映射参数' },
      400
    );
  }
 
  let updatedText = article.transcriptText;
  let updatedHtml = article.transcriptHtml;
 
  // 1. First pass: Replace source names with unique temporary placeholders to avoid swap collisions
  const placeholders: Record<string, string> = {};
  let tempIdx = 0;
  
  for (const [genericName, realName] of Object.entries(mapping)) {
    const sourceName = genericName.trim();
    const targetName = (realName || '').trim();
    if (!sourceName || !targetName || sourceName === targetName) continue;
 
    const tempPlaceholder = `__TEMP_SPEAKER_NAME_COLLISION_${tempIdx}__`;
    placeholders[tempPlaceholder] = targetName;
    tempIdx++;
 
    const escapedGeneric = sourceName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
 
    // Replace in Text: match "[00:15] genericName:"
    const textRegex = new RegExp(`(^|\\n)(\\[\\d{2}:\\d{2}(?::\\d{2})?\\\]\\s+)${escapedGeneric}:`, 'g');
    updatedText = updatedText.replace(textRegex, `$1$2${tempPlaceholder}:`);
 
    // Replace in HTML: match `<span class="text-foreground/80">genericName</span>`
    const htmlRegex = new RegExp(`<span class="text-foreground/80">${escapedGeneric}</span>`, 'g');
    updatedHtml = updatedHtml.replace(htmlRegex, `<span class="text-foreground/80">${tempPlaceholder}</span>`);
  }
 
  // 2. Second pass: Replace the placeholders with the final target names
  let replacedCount = 0;
  for (const [tempPlaceholder, targetName] of Object.entries(placeholders)) {
    const escapedPlaceholder = tempPlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
 
    // Replace in Text
    const textRegex = new RegExp(`(^|\\n)(\\[\\d{2}:\\d{2}(?::\\d{2})?\\\]\\s+)${escapedPlaceholder}:`, 'g');
    updatedText = updatedText.replace(textRegex, `$1$2${targetName}:`);
 
    // Replace in HTML
    const htmlRegex = new RegExp(`<span class="text-foreground/80">${escapedPlaceholder}</span>`, 'g');
    updatedHtml = updatedHtml.replace(htmlRegex, `<span class="text-foreground/80">${targetName}</span>`);
    
    replacedCount++;
  }
 
  if (replacedCount > 0) {
    db.update(articles)
      .set({
        transcriptText: updatedText,
        transcriptHtml: updatedHtml,
      })
      .where(eq(articles.id, id))
      .run();
  }
 
  return c.json<ApiResponse<{ replacedCount: number }>>({
    success: true,
    data: { replacedCount },
    message: replacedCount > 0
      ? `成功更新并修改了 ${replacedCount} 个发言人姓名。`
      : '发言人姓名未发生变更。',
  });
});
