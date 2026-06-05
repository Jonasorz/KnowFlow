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
    openaiApiKey: allSettings.openaiApiKey,
    anthropicApiKey: allSettings.anthropicApiKey,
    deepseekApiKey: allSettings.deepseekApiKey,
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
