import { Hono, type Context } from 'hono';
import { settingsSchema, type ApiResponse, type Settings } from '@knowflow/shared';
import { loadSettings, saveSettings, getDajialaApiKey } from '../services/settings.js';

export const settingsRoutes = new Hono();

// ============================================================
// GET / — get all settings
// ============================================================
settingsRoutes.get('/', async (c) => {
  const settings = await loadSettings();

  // Mask sensitive API keys in the response
  const masked: Settings = {
    ...settings,
    dajialaApiKey: settings.dajialaApiKey ? maskKey(settings.dajialaApiKey) : undefined,
    openaiApiKey: settings.openaiApiKey ? maskKey(settings.openaiApiKey) : undefined,
    anthropicApiKey: settings.anthropicApiKey ? maskKey(settings.anthropicApiKey) : undefined,
    deepseekApiKey: settings.deepseekApiKey ? maskKey(settings.deepseekApiKey) : undefined,
    twitterApiKey: settings.twitterApiKey ? maskKey(settings.twitterApiKey) : undefined,
    tavilyApiKey: settings.tavilyApiKey ? maskKey(settings.tavilyApiKey) : undefined,
  };

  return c.json<ApiResponse<Settings>>({
    success: true,
    data: masked,
  });
});

// ============================================================
// PUT/PATCH / — update settings
// ============================================================
const updateSettingsHandler = async (c: Context) => {
  const body = await c.req.json();

  // Validate with partial schema — allow updating individual fields
  const parsed = settingsSchema.partial().safeParse(body);
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

  const updated = await saveSettings(parsed.data);

  // Mask keys in the response
  const masked: Settings = {
    ...updated,
    dajialaApiKey: updated.dajialaApiKey ? maskKey(updated.dajialaApiKey) : undefined,
    openaiApiKey: updated.openaiApiKey ? maskKey(updated.openaiApiKey) : undefined,
    anthropicApiKey: updated.anthropicApiKey ? maskKey(updated.anthropicApiKey) : undefined,
    deepseekApiKey: updated.deepseekApiKey ? maskKey(updated.deepseekApiKey) : undefined,
    twitterApiKey: updated.twitterApiKey ? maskKey(updated.twitterApiKey) : undefined,
    tavilyApiKey: updated.tavilyApiKey ? maskKey(updated.tavilyApiKey) : undefined,
  };

  return c.json<ApiResponse<Settings>>({
    success: true,
    data: masked,
    message: 'Settings updated successfully',
  });
};

settingsRoutes.put('/', updateSettingsHandler);
settingsRoutes.patch('/', updateSettingsHandler);

// ============================================================
// GET /dajiala/balance — get Dajiala API balance
// ============================================================
settingsRoutes.get('/dajiala/balance', async (c) => {
  const apiKey = await getDajialaApiKey();
  if (!apiKey) {
    return c.json<ApiResponse>(
      { success: false, error: '极致了 API Key 未配置，请先在设置中填写并保存。' },
      400
    );
  }

  try {
    const response = await fetch('https://www.dajiala.com/fbmain/monitor/v3/get_remain_money', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: apiKey }),
    });

    if (!response.ok) {
      const text = await response.text();
      return c.json<ApiResponse>(
        { success: false, error: `极致了 API 返回错误: ${text}` },
        response.status as any
      );
    }

    const data = await response.json();
    return c.json<ApiResponse>({
      success: true,
      data,
    });
  } catch (err) {
    return c.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : '查询余额失败' },
      500
    );
  }
});

// ============================================================
// POST /test-key — test API key validity
// ============================================================
settingsRoutes.post('/test-key', async (c) => {
  const body = await c.req.json<{ provider: string; key: string }>();
  const { provider, key } = body;

  if (!key || key.trim().length === 0) {
    return c.json<ApiResponse<{ valid: boolean }>>({
      success: true,
      data: { valid: false },
    });
  }

  let valid = false;

  try {
    if (provider === 'dajiala') {
      const response = await fetch('https://www.dajiala.com/fbmain/monitor/v3/wx_account/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, keyword: 'test' }),
      });
      console.log('[Test Key] Dajiala response status:', response.status);
      const text = await response.text();
      console.log('[Test Key] Dajiala response text:', text);
      if (response.ok) {
        try {
          const json = JSON.parse(text);
          valid = json && json.code !== 10002 && json.code !== 10001;
        } catch (e) {
          valid = false;
        }
      }
    } else if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      valid = response.status === 200;
    } else if (provider === 'deepseek') {
      const response = await fetch('https://api.deepseek.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      valid = response.status === 200;
    } else if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      valid = response.status !== 401 && response.status !== 403;
    } else if (provider === 'twitter') {
      // Fetch user profile of '@twitter' to check key validity
      const response = await fetch('https://api.twitterapi.io/twitter/user/info?userName=twitter', {
        headers: { 'X-API-Key': key },
      });
      valid = response.status === 200;
    } else if (provider === 'tavily') {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key, query: 'test', max_results: 1 }),
      });
      valid = response.status === 200;
    }
  } catch (err) {
    console.error(`Error testing API key for ${provider}:`, err);
    valid = false;
  }

  return c.json<ApiResponse<{ valid: boolean }>>({
    success: true,
    data: { valid },
  });
});

// ============================================================
// Helpers
// ============================================================

/**
 * Mask an API key, showing only the first 4 and last 4 characters.
 */
function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}${'*'.repeat(key.length - 8)}${key.slice(-4)}`;
}
