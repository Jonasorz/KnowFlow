import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import type { AIModel } from '@knowflow/shared';

export interface ProviderConfig {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  deepseekApiKey?: string;
}

/**
 * Create AI model instances based on the provided API keys.
 * Uses the Vercel AI SDK unified interface.
 */
export function createProviders(config: ProviderConfig) {
  const providers: Record<string, ReturnType<typeof createOpenAI> | ReturnType<typeof createAnthropic> | ReturnType<typeof createDeepSeek>> = {};

  if (config.openaiApiKey) {
    providers.openai = createOpenAI({ apiKey: config.openaiApiKey });
  }

  if (config.anthropicApiKey) {
    providers.anthropic = createAnthropic({ apiKey: config.anthropicApiKey });
  }

  if (config.deepseekApiKey) {
    providers.deepseek = createDeepSeek({ apiKey: config.deepseekApiKey });
  }

  return providers;
}

/**
 * Map model names to their provider model identifiers.
 */
const MODEL_MAP: Record<AIModel, { provider: string; model: string }> = {
  'gpt-4o': { provider: 'openai', model: 'gpt-4o' },
  'gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini' },
  'claude-sonnet': { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  'claude-haiku': { provider: 'anthropic', model: 'claude-haiku-4-20250414' },
  'deepseek-chat': { provider: 'deepseek', model: 'deepseek-chat' },
  'deepseek-reasoner': { provider: 'deepseek', model: 'deepseek-reasoner' },
};

/**
 * Get the language model instance for a given model name.
 */
export function getModel(modelName: AIModel, config: ProviderConfig) {
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

export { MODEL_MAP };
