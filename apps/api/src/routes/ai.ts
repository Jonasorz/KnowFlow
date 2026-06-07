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
import { getModel, getModelSettings, PROMPTS } from '@knowflow/ai';
import { getProviderConfig, loadSettings } from '../services/settings.js';

const { articles, aiResults, sources } = schema;

export const aiRoutes = new Hono();

// ============================================================
// Prompt Generation Helper
// ============================================================
async function generatePrompts(
  skill: string,
  content: string,
  question: string | undefined,
  webSearch: boolean,
  settings: Settings,
  isPodcast: boolean,
  articleId?: string
): Promise<{ systemPrompt: string; userPrompt: string }> {
  let systemPrompt = '';
  let userPrompt = '';

  if (skill === 'summary') {
    if (isPodcast) {
      systemPrompt = settings.podcastSummarySystemPrompt || `你是一个专业的播客内容精炼专家和知识提炼大师。你的任务是分析播客单集的逐字稿或大纲内容，生成极具深度和可读性的复盘与要点梳理。
**极其重要**：你必须直接从 \`1. 🎙️ **单集简介 (Introduction)**\` 开始输出，绝对不能包含任何前言、客套话、引导语、寒暄或自我介绍（例如：‘好的，我将为您...’、‘作为一名专业的播客内容精炼专家...’），也不要在结尾输出任何结语。请直接、干净地输出 Markdown 格式的总结内容。

输出结构要求（请使用 Markdown 格式渲染，文字要生动、深刻且排版优美）：
1. 🎙️ **单集简介 (Introduction)**：用一两段话概括本集讨论的核心主题和核心氛围。
2. 💡 **核心要点 (Key Takeaways)**：提炼出播客中讨论的 4-6 个最重要、最深刻的观点或知识点，每个要点下进行详细阐述（包含支持该观点的论据、案例或讨论过程）。
3. 📚 **节目中提到的参考与实体 (References & Entities)**：
   - 📖 **提及书籍 (Books)**
   - 📄 **学术论文 (Papers)**
   - 🎬 **电影/纪录片/播客 (Media)**
   - 👤 **关键人物 (Key People)**
   - 💻 **软硬件产品 (Products & Tools)**（如软件、硬件、平台、工具、技术品牌等）
   （如果播客中没有提到相关类型，则该项相关部分留空。如果提到，请标明上下文提及背景）
4. 🗺️ **思维导图大纲 (Chronological Outline)**：按时间顺序或逻辑顺序，列出播客讨论的章节大纲，帮助读者快速了解结构。`;
      
      const userPromptTemplate = settings.podcastSummaryUserPrompt || '请对以下播客单集内容进行专业的要点提炼、参考资料/人物提取及大纲总结：\n\n{{content}}';
      userPrompt = userPromptTemplate.replace('{{content}}', content);
    } else {
      systemPrompt = settings.summarySystemPrompt || PROMPTS.summary.system;
      const userPromptTemplate = settings.summaryUserPrompt || '请对以下文章进行总结：\n\n{{content}}';
      userPrompt = userPromptTemplate.replace('{{content}}', content);
    }
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
1. ${searchContext ? '结合文章内容 and 联网搜索信息回答' : '只基于文章内容回答，不要编造信息'}
2. 如果信息不足以回答，请明确告知
3. 回答要简洁明了，用中文回答
4. ${searchContext ? '在引用的地方标注引用序号，例如 [1]，并在回答末尾以超链接或纯文本格式列出参考链接和来源名称。' : '适当引用原文来支持你的回答'}`;

    userPrompt = `文章内容：\n${content}\n${searchContext}\n\n问题：${question}`;
  } else {
    if (isPodcast) {
      systemPrompt = `你是一个思维导图生成助手。你的任务是将播客单集内容（包括 Shownotes 和逐字稿）转化为结构化的思维导图 JSON 数据。
请以 JSON 格式输出，格式如下：
{
  "id": "root",
  "label": "播客单集标题",
  "children": [
    {
      "id": "1",
      "label": "[02:09] 对应章节主要分支名称",
      "children": [
        { "id": "1-1", "label": "章节具体讨论细节" }
      ]
    }
  ]
}

规则：
1. 最多3层深度。
2. 第一层子节点（也就是大章节）的 label 中，必须在开头带上该部分内容在逐字稿中出现的精确时间戳，格式为 "[MM:SS]" 或 "[HH:MM:SS]"，例如 "[02:09] 核心要点分析"、"[01:15:30] 未来趋势展望"。如果无时间戳，则不带。
3. 章节下的子节点（第三层细节）不要带时间戳。
4. 每层不超过 6 个节点。
5. 标签文字要精炼，优先提炼核心名词或短句。
6. 确保输出是合法的 JSON，不要包含任何 markdown 代码块标记。`;

      let summaryContext = '';
      if (articleId) {
        const db = getDatabase();
        const summaryRow = db
          .select({ result: aiResults.result })
          .from(aiResults)
          .where(and(eq(aiResults.articleId, articleId), eq(aiResults.skillType, 'summary')))
          .get();
        if (summaryRow?.result) {
          summaryContext = summaryRow.result;
        }
      }

      let promptText = `请将以下播客内容转化为包含时间戳的思维导图结构：\n\n${content}`;
      if (summaryContext) {
        promptText = `这里是已为该单集生成的 AI 总结和大纲，其中最后一部分包含了本单集的【思维导图大纲 (Chronological Outline)】以及各章节出现的时间戳：\n\n${summaryContext}\n\n请必须对照上述【思维导图大纲 (Chronological Outline)】中的结构、章节名字和对应的时间戳，将其转化为结构化的思维导图 JSON 数据。章节名称（即第一层子节点）和对应的 [MM:SS] 或 [HH:MM:SS] 时间戳（例如："[02:09] 对应章节主要分支名称"）必须与上述大纲完全一致！\n\n播客详细内容（Shownotes与逐字稿）作为补充参考：\n\n${content}`;
      }
      userPrompt = promptText;
    } else {
      systemPrompt = PROMPTS.mindmap.system;
      userPrompt = PROMPTS.mindmap.user(content);
    }
  }

  return { systemPrompt, userPrompt };
}

function cleanFluff(text: string, skill: string): string {
  if (skill !== 'summary') return text;
  
  let cleaned = text.trim();
  
  // Look for common start markers
  const startMarkers = [
    '1. 🎙️',
    '1.🎙️',
    '🎙️',
    '1. **单集简介',
    '**单集简介',
    '# '
  ];
  
  for (const marker of startMarkers) {
    const idx = cleaned.indexOf(marker);
    if (idx !== -1 && idx < 300) { // Only clean if the marker is near the beginning
      cleaned = cleaned.substring(idx);
      break;
    }
  }
  
  // Also remove trailing fluff
  const trailingFluffRegex = /(?:---+\s*)?(?:希望(?:这期|这些|对您)?有帮助|以上就是|供您参考|感谢您的听写|让我们共同进步|如果你有其他问题).*\s*$/gi;
  cleaned = cleaned.replace(trailingFluffRegex, '').trim();
  
  return cleaned;
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

  const source = db
    .select({ type: sources.type })
    .from(sources)
    .where(eq(sources.id, article.sourceId))
    .get();
  const isPodcast = source?.type === 'podcast';

  let content = '';
  if (isPodcast) {
    const parts = [];
    if (article.contentText && article.contentText.trim().length > 0) {
      parts.push(`【节目介绍 (Shownotes)】:\n${article.contentText.trim()}`);
    }
    if (article.transcriptText && article.transcriptText.trim().length > 0) {
      parts.push(`【节目逐字稿 (Transcript)】:\n${article.transcriptText.trim()}`);
    }
    content = parts.join('\n\n');
  }
  if (!content || content.trim().length === 0) {
    content = article.contentText || article.summary || article.title;
  }

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
    settings,
    isPodcast,
    articleId
  );

  const result = await streamText({
    model: aiModel,
    system: systemPrompt,
    prompt: userPrompt,
    ...getModelSettings(model),
  });

  let fullText = '';
  for await (const chunk of result.textStream) {
    fullText += chunk;
  }

  const aiResultId = uuidv4();
  const cleanedResult = cleanFluff(fullText, skill);
  db.insert(aiResults)
    .values({
      id: aiResultId,
      articleId,
      skillType: skill,
      modelUsed: model,
      prompt: question || undefined,
      result: cleanedResult,
    })
    .run();

  const aiResultInfo: AIResultInfo = {
    id: aiResultId,
    articleId,
    skillType: skill,
    modelUsed: model,
    prompt: question,
    result: cleanedResult,
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

  const source = db
    .select({ type: sources.type })
    .from(sources)
    .where(eq(sources.id, article.sourceId))
    .get();
  const isPodcast = source?.type === 'podcast';

  let content = '';
  if (isPodcast) {
    const parts = [];
    if (article.contentText && article.contentText.trim().length > 0) {
      parts.push(`【节目介绍 (Shownotes)】:\n${article.contentText.trim()}`);
    }
    if (article.transcriptText && article.transcriptText.trim().length > 0) {
      parts.push(`【节目逐字稿 (Transcript)】:\n${article.transcriptText.trim()}`);
    }
    content = parts.join('\n\n');
  }
  if (!content || content.trim().length === 0) {
    content = article.contentText || article.summary || article.title;
  }

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
    settings,
    isPodcast,
    articleId
  );

  const result = streamText({
    model: aiModel,
    system: systemPrompt,
    prompt: userPrompt,
    ...getModelSettings(model),
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
        result: cleanFluff(fullText, skill),
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
