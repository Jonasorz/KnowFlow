import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================================
// Sources — 订阅源（公众号、Twitter用户、播客、视频频道等）
// ============================================================
export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['wechat', 'twitter', 'podcast', 'video'] }).notNull(),
  name: text('name').notNull(),
  identifier: text('identifier').notNull(), // biz for wechat, username for twitter, etc.
  avatarUrl: text('avatar_url'),
  description: text('description'),
  config: text('config', { mode: 'json' }).$type<Record<string, unknown>>(), // source-specific config
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastSyncAt: text('last_sync_at'),
  tags: text('tags', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ============================================================
// Articles — 文章/内容条目
// ============================================================
export const articles = sqliteTable('articles', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  author: text('author'),
  summary: text('summary'), // AI-generated summary
  contentText: text('content_text'), // plain text content
  contentHtml: text('content_html'), // HTML content
  originalUrl: text('original_url'),
  coverImageUrl: text('cover_image_url'),
  readCount: integer('read_count'),
  likeCount: integer('like_count'),
  commentCount: integer('comment_count'),
  audioUrl: text('audio_url'),
  duration: integer('duration'),
  transcriptText: text('transcript_text'),
  transcriptHtml: text('transcript_html'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  isStarred: integer('is_starred', { mode: 'boolean' }).notNull().default(false),
  publishedAt: text('published_at'),
  fetchedAt: text('fetched_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ============================================================
// AI Results — AI 处理结果（摘要、问答、思维导图等）
// ============================================================
export const aiResults = sqliteTable('ai_results', {
  id: text('id').primaryKey(),
  articleId: text('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  skillType: text('skill_type', { enum: ['summary', 'qa', 'mindmap'] }).notNull(),
  modelUsed: text('model_used').notNull(), // e.g., 'gpt-4o', 'claude-sonnet', 'deepseek-v3'
  prompt: text('prompt'),
  result: text('result').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ============================================================
// Settings — 用户设置（API keys, 偏好等）
// ============================================================
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ============================================================
// Type exports
// ============================================================
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type AIResult = typeof aiResults.$inferSelect;
export type NewAIResult = typeof aiResults.$inferInsert;
export type Setting = typeof settings.$inferSelect;
