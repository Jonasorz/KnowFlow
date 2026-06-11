import { Hono, type Context } from 'hono';
import { settingsSchema, type ApiResponse, type Settings } from '@knowflow/shared';
import { loadSettings, saveSettings, getDajialaApiKey, getTwitterApiKey } from '../services/settings.js';
import { appendFileSync } from 'fs';
import { join } from 'path';

function logDebug(message: string) {
  if (process.env.KNOWFLOW_DEBUG !== 'true') return;

  try {
    const logPath = join(process.cwd(), 'debug_test_key.log');
    appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch (e) {
    console.error('Failed to write to debug_test_key.log:', e);
  }
}

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
    moonshotApiKey: settings.moonshotApiKey ? maskKey(settings.moonshotApiKey) : undefined,
    deepseekApiKey: settings.deepseekApiKey ? maskKey(settings.deepseekApiKey) : undefined,
    twitterApiKey: settings.twitterApiKey ? maskKey(settings.twitterApiKey) : undefined,
    tavilyApiKey: settings.tavilyApiKey ? maskKey(settings.tavilyApiKey) : undefined,
    openrouterApiKey: settings.openrouterApiKey ? maskKey(settings.openrouterApiKey) : undefined,
    dashscopeApiKey: settings.dashscopeApiKey ? maskKey(settings.dashscopeApiKey) : undefined,
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

  const updates = { ...parsed.data };
  const keysToFilter: Array<keyof Settings> = [
    'dajialaApiKey',
    'moonshotApiKey',
    'deepseekApiKey',
    'twitterApiKey',
    'tavilyApiKey',
    'openrouterApiKey',
    'dashscopeApiKey',
  ];

  for (const key of keysToFilter) {
    if (updates[key] && typeof updates[key] === 'string' && (updates[key] as string).includes('*')) {
      delete updates[key];
    }
  }

  const updated = await saveSettings(updates);

  // Mask keys in the response
  const masked: Settings = {
    ...updated,
    dajialaApiKey: updated.dajialaApiKey ? maskKey(updated.dajialaApiKey) : undefined,
    moonshotApiKey: updated.moonshotApiKey ? maskKey(updated.moonshotApiKey) : undefined,
    deepseekApiKey: updated.deepseekApiKey ? maskKey(updated.deepseekApiKey) : undefined,
    twitterApiKey: updated.twitterApiKey ? maskKey(updated.twitterApiKey) : undefined,
    tavilyApiKey: updated.tavilyApiKey ? maskKey(updated.tavilyApiKey) : undefined,
    openrouterApiKey: updated.openrouterApiKey ? maskKey(updated.openrouterApiKey) : undefined,
    dashscopeApiKey: updated.dashscopeApiKey ? maskKey(updated.dashscopeApiKey) : undefined,
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
// GET /twitter/balance — get Twitter API balance
// ============================================================
settingsRoutes.get('/twitter/balance', async (c) => {
  const apiKey = await getTwitterApiKey();
  if (!apiKey) {
    return c.json<ApiResponse>(
      { success: false, error: 'X (Twitter) API Key 未配置，请先在设置中填写并保存。' },
      400
    );
  }

  try {
    const response = await fetch('https://api.twitterapi.io/oapi/my/info', {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return c.json<ApiResponse>(
        { success: false, error: `Twitter API 返回错误: ${text}` },
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
// GET /moonshot/balance — get Moonshot API balance
// ============================================================
settingsRoutes.get('/moonshot/balance', async (c) => {
  const settings = await loadSettings();
  const apiKey = settings.moonshotApiKey;
  if (!apiKey) {
    return c.json<ApiResponse>(
      { success: false, error: 'Moonshot API Key 未配置，请先在设置中填写并保存。' },
      400
    );
  }

  try {
    const response = await fetch('https://api.moonshot.cn/v1/users/me/balance', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return c.json<ApiResponse>(
        { success: false, error: `Moonshot API 返回错误: ${text}` },
        response.status as any
      );
    }

    const resJson = await response.json() as any;
    return c.json<ApiResponse>({
      success: true,
      data: resJson.data || resJson,
    });
  } catch (err) {
    return c.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : '查询余额失败' },
      500
    );
  }
});

// ============================================================
// GET /deepseek/balance — get DeepSeek API balance
// ============================================================
settingsRoutes.get('/deepseek/balance', async (c) => {
  const settings = await loadSettings();
  const apiKey = settings.deepseekApiKey;
  if (!apiKey) {
    return c.json<ApiResponse>(
      { success: false, error: 'DeepSeek API Key 未配置，请先在设置中填写并保存。' },
      400
    );
  }

  try {
    const response = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return c.json<ApiResponse>(
        { success: false, error: `DeepSeek API 返回错误: ${text}` },
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
// GET /tavily/balance — get Tavily API usage/balance
// ============================================================
settingsRoutes.get('/tavily/balance', async (c) => {
  const settings = await loadSettings();
  const apiKey = settings.tavilyApiKey;
  if (!apiKey) {
    return c.json<ApiResponse>(
      { success: false, error: 'Tavily API Key 未配置，请先在设置中填写并保存。' },
      400
    );
  }

  try {
    const response = await fetch('https://api.tavily.com/usage', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return c.json<ApiResponse>(
        { success: false, error: `Tavily API 返回错误: ${text}` },
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
// GET /openrouter/balance — get OpenRouter API balance/limits
// ============================================================
settingsRoutes.get('/openrouter/balance', async (c) => {
  const settings = await loadSettings();
  const apiKey = settings.openrouterApiKey;
  if (!apiKey) {
    return c.json<ApiResponse>(
      { success: false, error: 'OpenRouter API Key 未配置，请先在设置中填写并保存。' },
      400
    );
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return c.json<ApiResponse>(
        { success: false, error: `OpenRouter API 返回错误: ${text}` },
        response.status as any
      );
    }

    const resJson = await response.json() as any;
    const keyData = resJson.data || resJson;

    // Try to get account-level credits
    let totalCredits: number | null = null;
    let totalUsage: number | null = null;
    try {
      const creditsResponse = await fetch('https://openrouter.ai/api/v1/credits', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (creditsResponse.ok) {
        const creditsJson = await creditsResponse.json() as any;
        const creditsData = creditsJson.data || creditsJson;
        if (creditsData) {
          totalCredits = typeof creditsData.total_credits === 'number' ? creditsData.total_credits : null;
          totalUsage = typeof creditsData.total_usage === 'number' ? creditsData.total_usage : null;
        }
      }
    } catch (creditsErr) {
      console.error('Failed to fetch OpenRouter credits:', creditsErr);
    }

    return c.json<ApiResponse>({
      success: true,
      data: {
        ...keyData,
        total_credits: totalCredits,
        total_usage: totalUsage,
      },
    });
  } catch (err) {
    return c.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : '查询余额失败' },
      500
    );
  }
});

// ============================================================
// GET /openrouter/models — list OpenRouter models
// ============================================================
settingsRoutes.get('/openrouter/models', async (c) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
    });

    if (!response.ok) {
      const text = await response.text();
      return c.json<ApiResponse>(
        { success: false, error: `OpenRouter API 返回错误: ${text}` },
        response.status as any
      );
    }

    const resJson = await response.json() as any;
    return c.json<ApiResponse>({
      success: true,
      data: resJson.data || [],
    });
  } catch (err) {
    return c.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : '获取模型列表失败' },
      500
    );
  }
});

// ============================================================
// GET /dashscope/balance — get DashScope API balance info
// ============================================================
settingsRoutes.get('/dashscope/balance', async (c) => {
  const settings = await loadSettings();
  if (!settings.dashscopeApiKey) {
    return c.json<ApiResponse>(
      { success: false, error: '通义听悟 (DashScope) API Key 未配置，请先在设置中填写并保存。' },
      400
    );
  }

  return c.json<ApiResponse>({
    success: true,
    data: {
      billingType: '后付费/免费额度',
      balance: '需登录控制台查看',
      tips: 'DashScope 采用阿里云统一账户计费，并在百炼控制台提供免费额度用量查询，API 不直接返回账户金额余额。',
      consoleUrl: 'https://billing-cost.console.aliyun.com/home?spm=a2ty02.30267245.console-base_top-nav.d_myaliyun_2_cost_title.24c074a1EX1qfQ'
    }
  });
});

// ============================================================
// POST /test-key — test API key validity
// ============================================================
settingsRoutes.post('/test-key', async (c) => {
  const body = await c.req.json<{ provider: string; key: string }>();
  const { provider, key } = body;

  logDebug(`Testing API key for provider: ${provider}, key provided length: ${key?.length || 0}`);

  if (!key || key.trim().length === 0) {
    logDebug(`Provider ${provider}: key is empty.`);
    return c.json<ApiResponse<{ valid: boolean }>>({
      success: true,
      data: { valid: false },
    });
  }

  let actualKey = key;
  if (key.includes('*')) {
    const settings = await loadSettings();
    if (provider === 'dajiala') {
      actualKey = settings.dajialaApiKey || '';
    } else if (provider === 'deepseek') {
      actualKey = settings.deepseekApiKey || '';
    } else if (provider === 'moonshot') {
      actualKey = settings.moonshotApiKey || '';
    } else if (provider === 'twitter') {
      actualKey = settings.twitterApiKey || '';
    } else if (provider === 'tavily') {
      actualKey = settings.tavilyApiKey || '';
    } else if (provider === 'openrouter') {
      actualKey = settings.openrouterApiKey || '';
    } else if (provider === 'dashscope') {
      actualKey = settings.dashscopeApiKey || '';
    }
    logDebug(`Unmasked key for provider ${provider}: key length is ${actualKey.length}`);
  }

  if (!actualKey || actualKey.trim().length === 0) {
    logDebug(`Provider ${provider}: unmasked key is empty.`);
    return c.json<ApiResponse<{ valid: boolean }>>({
      success: true,
      data: { valid: false },
    });
  }

  let valid = false;

  try {
    if (provider === 'dajiala') {
      const response = await fetch('https://www.dajiala.com/fbmain/monitor/v3/get_remain_money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: actualKey }),
      });
      const text = await response.text();
      logDebug(`Dajiala status: ${response.status}, body: ${text}`);
      if (response.ok) {
        try {
          const json = JSON.parse(text);
          valid = json && json.code !== 10002 && json.code !== 10001;
        } catch (e) {
          valid = false;
        }
      }
    } else if (provider === 'deepseek') {
      const response = await fetch('https://api.deepseek.com/v1/models', {
        headers: { Authorization: `Bearer ${actualKey}` },
      });
      const text = await response.text();
      logDebug(`DeepSeek status: ${response.status}, body: ${text.slice(0, 200)}`);
      valid = response.status === 200;
    } else if (provider === 'moonshot') {
      const response = await fetch('https://api.moonshot.cn/v1/models', {
        headers: { Authorization: `Bearer ${actualKey}` },
      });
      const text = await response.text();
      logDebug(`Moonshot status: ${response.status}, body: ${text.slice(0, 200)}`);
      valid = response.status === 200;
    } else if (provider === 'twitter') {
      logDebug(`Sending fetch request to https://api.twitterapi.io/twitter/user/info?userName=twitter`);
      const response = await fetch('https://api.twitterapi.io/twitter/user/info?userName=twitter', {
        headers: { 'X-API-Key': actualKey },
      });
      const text = await response.text();
      logDebug(`Twitter status: ${response.status}, body: ${text.slice(0, 500)}`);
      valid = response.status === 200;
    } else if (provider === 'tavily') {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: actualKey, query: 'test', max_results: 1 }),
      });
      const text = await response.text();
      logDebug(`Tavily status: ${response.status}, body: ${text.slice(0, 200)}`);
      valid = response.status === 200;
    } else if (provider === 'openrouter') {
      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${actualKey}` },
      });
      const text = await response.text();
      logDebug(`OpenRouter status: ${response.status}, body: ${text.slice(0, 200)}`);
      valid = response.status === 200;
    } else if (provider === 'dashscope') {
      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/models', {
        headers: { Authorization: `Bearer ${actualKey}` },
      });
      const text = await response.text();
      logDebug(`DashScope status: ${response.status}, body: ${text.slice(0, 200)}`);
      valid = response.status === 200;
    }
  } catch (err) {
    logDebug(`Error testing key for ${provider}: ${err instanceof Error ? err.stack : err}`);
    valid = false;
  }

  logDebug(`Provider ${provider} validity result: ${valid}`);

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
