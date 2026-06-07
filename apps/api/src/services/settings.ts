import { getDatabase } from '@knowflow/db';
import { schema } from '@knowflow/db';
import { eq, sql } from 'drizzle-orm';
import type { Settings } from '@knowflow/shared';
import { PROMPTS } from '@knowflow/ai';

const { settings } = schema;

// Default settings values
const DEFAULT_SETTINGS: Settings = {
  defaultAIModel: 'deepseek-chat',
  theme: 'system',
  language: 'zh',
  summarySystemPrompt: PROMPTS.summary.system,
  summaryUserPrompt: '请对以下文章进行总结：\n\n{{content}}',
  podcastSummarySystemPrompt: `你是一个专业的播客内容精炼专家和知识提炼大师。你的任务是分析播客单集的逐字稿或大纲内容，生成极具深度和可读性的复盘与要点梳理。
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
4. 🗺️ **思维导图大纲 (Chronological Outline)**：按时间顺序或逻辑顺序，列出播客讨论的章节大纲，帮助读者快速了解结构。`,
  podcastSummaryUserPrompt: '请对以下播客单集内容进行专业的要点提炼、参考资料/人物提取及大纲总结：\n\n{{content}}',
};

/**
 * Load all settings from the database and merge with defaults.
 */
export async function loadSettings(): Promise<Settings> {
  const db = getDatabase();
  const rows = db.select().from(settings).all();

  const stored: Record<string, unknown> = {};
  for (const row of rows) {
    stored[row.key] = row.value;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
  } as Settings;
}

/**
 * Get a single setting value.
 */
export async function getSetting<K extends keyof Settings>(
  key: K
): Promise<Settings[K] | undefined> {
  const db = getDatabase();
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get();

  if (!row) return DEFAULT_SETTINGS[key];
  return row.value as Settings[K];
}

/**
 * Save / update multiple settings at once.
 */
export async function saveSettings(
  updates: Partial<Settings>
): Promise<Settings> {
  const db = getDatabase();

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    db.insert(settings)
      .values({
        key,
        value: value as unknown,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: value as unknown,
          updatedAt: new Date().toISOString(),
        },
      })
      .run();
  }

  return loadSettings();
}

/**
 * Get API keys needed for AI providers from settings.
 */
export async function getProviderConfig() {
  const allSettings = await loadSettings();
  return {
    moonshotApiKey: allSettings.moonshotApiKey,
    deepseekApiKey: allSettings.deepseekApiKey,
    openrouterApiKey: allSettings.openrouterApiKey,
    dashscopeApiKey: allSettings.dashscopeApiKey,
  };
}

/**
 * Get the 极致了 API key for WeChat access.
 */
export async function getDajialaApiKey(): Promise<string | undefined> {
  return getSetting('dajialaApiKey');
}

/**
 * Get the Twitter API key.
 */
export async function getTwitterApiKey(): Promise<string | undefined> {
  return getSetting('twitterApiKey');
}

/**
 * Get the Tavily API key for Web search access.
 */
export async function getTavilyApiKey(): Promise<string | undefined> {
  return getSetting('tavilyApiKey');
}
