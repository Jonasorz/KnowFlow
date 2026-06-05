import { Hono } from 'hono';
import { streamText } from 'ai';
import { stream } from 'hono/streaming';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@knowflow/db';
import { schema } from '@knowflow/db';
import { eq, and } from 'drizzle-orm';
import {
  aiRequestSchema,
  type ApiResponse,
  type AIResultInfo,
  type Settings,
} from '@knowflow/shared';
import { getModel, PROMPTS } from '@knowflow/ai';
import { getProviderConfig, loadSettings } from '../services/settings.js';

const { articles, aiResults } = schema;

export const aiRoutes = new Hono();

// ============================================================
// Prompt Generation Helper
// ============================================================
async function generatePrompts(
  skill: string,
  content: string,
  question: string | undefined,
  webSearch: boolean,
  settings: Settings
): Promise<{ systemPrompt: string; userPrompt: string }> {
  let systemPrompt = '';
  let userPrompt = '';

  if (skill === 'summary') {
    systemPrompt = settings.summarySystemPrompt || PROMPTS.summary.system;
    const userPromptTemplate = settings.summaryUserPrompt || '请对以下文章进行总结：\n\n{{content}}';
    userPrompt = userPromptTemplate.replace('{{content}}', content);
  } else if (skill === 'qa') {
    let searchContext = '';
    if (webSearch) {
      const tavilyKey = settings.tavilyApiKey;
      if (tavilyKey) {
        try {
          const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: tavilyKey,
              query: question!,
              search_depth: 'basic',
              max_results: 3,
            }),
          });
          if (response.ok) {
            const json = await response.json() as {
              results: Array<{ title: string; url: string; content: string }>;
            };
            const searchResults = json.results || [];
            if (searchResults.length > 0) {
              searchContext = '\n\n联网搜索到的补充参考信息：\n' + searchResults
                .map((res, index) => `[${index + 1}] 来源: "${res.title}" (${res.url})\n内容: ${res.content}`)
                .join('\n\n');
            }
          }
        } catch (err) {
          console.error('Tavily search failed:', err);
        }
      }
    }

    systemPrompt = `你是一个智能问答助手。基于提供的文章内容${searchContext ? '以及联网搜索补充的信息' : ''}回答用户的问题。
规则：
1. ${searchContext ? '结合文章内容和联网搜索信息回答' : '只基于文章内容回答，不要编造信息'}
2. 如果信息不足以回答，请明确告知
3. 回答要简洁明了，用中文回答
4. ${searchContext ? '在引用的地方标注引用序号，例如 [1]，并在回答末尾以超链接或纯文本格式列出参考链接和来源名称。' : '适当引用原文来支持你的回答'}`;

    userPrompt = `文章内容：\n${content}\n${searchContext}\n\n问题：${question}`;
  } else {
    systemPrompt = PROMPTS.mindmap.system;
    userPrompt = PROMPTS.mindmap.user(content);
  }

  return { systemPrompt, userPrompt };
}

// ============================================================
// POST /run — AI skill processing (non-streaming)
// ============================================================
aiRoutes.post('/run', async (c) => {
  const body = await c.req.json();
  const parsed = aiRequestSchema.safeParse(body);

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

  const { articleId, skill, model, question } = parsed.data;

  if (skill === 'qa' && (!question || question.trim().length === 0)) {
    return c.json<ApiResponse>(
      { success: false, error: 'Question is required for QA skill' },
      400
    );
  }

  const db = getDatabase();
  const article = db
    .select()
    .from(articles)
    .where(eq(articles.id, articleId))
    .get();

  if (!article) {
    return c.json<ApiResponse>(
      { success: false, error: 'Article not found' },
      404
    );
  }

  const content = article.contentText || article.summary || article.title;
  if (!content || content.trim().length === 0) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: 'Article has no content. Please sync/fetch the article content first.',
      },
      400
    );
  }

  const providerConfig = await getProviderConfig();

  let aiModel;
  try {
    aiModel = getModel(model, providerConfig);
  } catch (err) {
    return c.json<ApiResponse>(
      { success: false, error: (err as Error).message },
      400
    );
  }

  const settings = await loadSettings();
  const { systemPrompt, userPrompt } = await generatePrompts(
    skill,
    content,
    question,
    parsed.data.webSearch,
    settings
  );

  const result = await streamText({
    model: aiModel,
    system: systemPrompt,
    prompt: userPrompt,
  });

  let fullText = '';
  for await (const chunk of result.textStream) {
    fullText += chunk;
  }

  const aiResultId = uuidv4();
  db.insert(aiResults)
    .values({
      id: aiResultId,
      articleId,
      skillType: skill,
      modelUsed: model,
      prompt: question || undefined,
      result: fullText,
    })
    .run();

  const aiResultInfo: AIResultInfo = {
    id: aiResultId,
    articleId,
    skillType: skill,
    modelUsed: model,
    prompt: question,
    result: fullText,
    createdAt: new Date().toISOString(),
  };

  return c.json<ApiResponse<AIResultInfo>>({
    success: true,
    data: aiResultInfo,
  });
});

// ============================================================
// POST /stream — AI skill processing (streaming raw text chunks)
// ============================================================
aiRoutes.post('/stream', async (c) => {
  const body = await c.req.json();
  const parsed = aiRequestSchema.safeParse(body);

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

  const { articleId, skill, model, question } = parsed.data;

  if (skill === 'qa' && (!question || question.trim().length === 0)) {
    return c.json<ApiResponse>(
      { success: false, error: 'Question is required for QA skill' },
      400
    );
  }

  const db = getDatabase();
  const article = db
    .select()
    .from(articles)
    .where(eq(articles.id, articleId))
    .get();

  if (!article) {
    return c.json<ApiResponse>(
      { success: false, error: 'Article not found' },
      404
    );
  }

  const content = article.contentText || article.summary || article.title;
  if (!content || content.trim().length === 0) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: 'Article has no content. Please sync/fetch the article content first.',
      },
      400
    );
  }

  const providerConfig = await getProviderConfig();

  let aiModel;
  try {
    aiModel = getModel(model, providerConfig);
  } catch (err) {
    return c.json<ApiResponse>(
      { success: false, error: (err as Error).message },
      400
    );
  }

  const settings = await loadSettings();
  const { systemPrompt, userPrompt } = await generatePrompts(
    skill,
    content,
    question,
    parsed.data.webSearch,
    settings
  );

  const result = streamText({
    model: aiModel,
    system: systemPrompt,
    prompt: userPrompt,
  });

  return stream(c, async (s) => {
    c.header('Content-Type', 'text/plain; charset=utf-8');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    let fullText = '';

    const textStream = (await result).textStream;
    for await (const chunk of textStream) {
      fullText += chunk;
      await s.write(chunk);
    }

    // Save result to DB after streaming is complete
    const aiResultId = uuidv4();
    db.insert(aiResults)
      .values({
        id: aiResultId,
        articleId,
        skillType: skill,
        modelUsed: model,
        prompt: question || undefined,
        result: fullText,
      })
      .run();
  });
});

// ============================================================
// GET /results/:articleId — get cached AI results for an article
// ============================================================
aiRoutes.get('/results/:articleId', async (c) => {
  const { articleId } = c.req.param();
  const db = getDatabase();

  // Verify article exists
  const article = db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, articleId))
    .get();

  if (!article) {
    return c.json<ApiResponse>(
      { success: false, error: 'Article not found' },
      404
    );
  }

  // Optionally filter by skill type
  const skillFilter = c.req.query('skill');
  const whereClause = skillFilter
    ? and(
        eq(aiResults.articleId, articleId),
        eq(aiResults.skillType, skillFilter as 'summary' | 'qa' | 'mindmap')
      )
    : eq(aiResults.articleId, articleId);

  const rows = db
    .select()
    .from(aiResults)
    .where(whereClause)
    .all();

  const results: AIResultInfo[] = rows.map((row) => ({
    id: row.id,
    articleId: row.articleId,
    skillType: row.skillType,
    modelUsed: row.modelUsed,
    prompt: row.prompt ?? undefined,
    result: row.result,
    createdAt: row.createdAt,
  }));

  return c.json<ApiResponse<AIResultInfo[]>>({
    success: true,
    data: results,
  });
});
