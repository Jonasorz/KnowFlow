import { createOpenAI } from '@ai-sdk/openai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import type { AIModel } from '@knowflow/shared';

export interface ProviderConfig {
  moonshotApiKey?: string;
  deepseekApiKey?: string;
  openrouterApiKey?: string;
}

/**
 * Create AI model instances based on the provided API keys.
 * Uses the Vercel AI SDK unified interface.
 */
export function createProviders(config: ProviderConfig) {
  const providers: Record<string, ReturnType<typeof createOpenAI> | ReturnType<typeof createDeepSeek>> = {};

  if (config.moonshotApiKey) {
    providers.moonshot = createOpenAI({
      baseURL: 'https://api.moonshot.cn/v1',
      apiKey: config.moonshotApiKey,
    });
  }

  if (config.deepseekApiKey) {
    providers.deepseek = createDeepSeek({ apiKey: config.deepseekApiKey });
  }

  if (config.openrouterApiKey) {
    providers.openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: config.openrouterApiKey,
    });
  }

  return providers;
}

/**
 * Map model names to their provider model identifiers.
 */
const MODEL_MAP: Record<string, { provider: string; model: string }> = {
  'kimi-k2.6': { provider: 'moonshot', model: 'kimi-k2.6' },
  'kimi-8k': { provider: 'moonshot', model: 'moonshot-v1-8k' },
  'kimi-32k': { provider: 'moonshot', model: 'moonshot-v1-32k' },
  'deepseek-chat': { provider: 'deepseek', model: 'deepseek-chat' },
  'deepseek-reasoner': { provider: 'deepseek', model: 'deepseek-reasoner' },
};

/**
 * Get the language model instance for a given model name.
 */
export function getModel(modelName: AIModel, config: ProviderConfig) {
  if (modelName.startsWith('openrouter/')) {
    const openrouterModel = modelName.replace('openrouter/', '');
    const providers = createProviders(config);
    const provider = providers.openrouter;
    if (!provider) {
      throw new Error(
        'API key not configured for provider: openrouter. ' +
        'Please set the openrouter API key in settings.'
      );
    }
    return (provider as CallableFunction)(openrouterModel);
  }

  const mapping = MODEL_MAP[modelName];
  if (!mapping) {
    throw new Error(`Unknown model: ${modelName}`);
  }

  const providers = createProviders(config);
  const provider = providers[mapping.provider];
  if (!provider) {
    throw new Error(
      `API key not configured for provider: ${mapping.provider}. ` +
      `Please set the ${mapping.provider} API key in settings.`
    );
  }

  // All providers follow the same callable pattern
  return (provider as CallableFunction)(mapping.model);
}

/**
 * Get execution settings (like temperature) for specific models.
 */
export function getModelSettings(modelName: AIModel) {
  if (modelName === 'kimi-k2.6') {
    return { temperature: 1 };
  }
  return {};
}

export { MODEL_MAP };


