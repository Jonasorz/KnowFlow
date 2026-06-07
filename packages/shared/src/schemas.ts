import { z } from 'zod';

// ============================================================
// Source schemas
// ============================================================
export const sourceTypeSchema = z.enum(['wechat', 'twitter', 'podcast', 'video']);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const createSourceSchema = z.object({
  type: sourceTypeSchema,
  name: z.string().min(1),
  identifier: z.string().min(1),
  avatarUrl: z.string().optional(),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});
export type CreateSourceInput = z.infer<typeof createSourceSchema>;

// ============================================================
// Article schemas
// ============================================================
export const articleFilterSchema = z.object({
  sourceId: z.string().optional(),
  tag: z.string().optional(),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  sortBy: z.enum(['publishedAt', 'readCount', 'createdAt']).default('publishedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ArticleFilter = z.infer<typeof articleFilterSchema>;

export const updateArticleSchema = z.object({
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
});
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;

// ============================================================
// AI schemas
// ============================================================
export const aiModelSchema = z.string();
export type AIModel = string;

export const aiSkillSchema = z.enum(['summary', 'qa', 'mindmap']);
export type AISkill = z.infer<typeof aiSkillSchema>;

export const aiRequestSchema = z.object({
  articleId: z.string(),
  skill: aiSkillSchema,
  model: aiModelSchema.default('deepseek-chat'),
  question: z.string().optional(), // required for QA skill
  webSearch: z.boolean().default(false), // Web search for QA
});
export type AIRequest = z.infer<typeof aiRequestSchema>;

// ============================================================
// Settings schemas
// ============================================================
export const settingsSchema = z.object({
  // API Keys
  dajialaApiKey: z.string().optional(),
  moonshotApiKey: z.string().optional(),
  deepseekApiKey: z.string().optional(),
  twitterApiKey: z.string().optional(),
  tavilyApiKey: z.string().optional(), // Tavily Search API key
  openrouterApiKey: z.string().optional(), // OpenRouter API key
  dashscopeApiKey: z.string().optional(), // Alibaba Cloud DashScope API Key (for Tongyi Tingwu)

  // Preferences
  defaultAIModel: aiModelSchema.default('deepseek-chat'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.enum(['zh', 'en']).default('zh'),

  // AI Prompt Templates
  summarySystemPrompt: z.string().optional(),
  summaryUserPrompt: z.string().optional(),
  podcastSummarySystemPrompt: z.string().optional(),
  podcastSummaryUserPrompt: z.string().optional(),
});
export type Settings = z.infer<typeof settingsSchema>;
