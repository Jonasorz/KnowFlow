import { getDatabase, schema } from '@knowflow/db';
import { sql } from 'drizzle-orm';

/**
 * Initialize the database, creating all tables if they don't exist.
 * Uses raw SQL CREATE TABLE IF NOT EXISTS to be safe on first run
 * without requiring a migration step.
 */
export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();

  db.run(sql`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('wechat', 'twitter', 'podcast', 'video')),
      name TEXT NOT NULL,
      identifier TEXT NOT NULL,
      avatar_url TEXT,
      description TEXT,
      config TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_sync_at TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  try {
    db.run(sql`ALTER TABLE sources ADD COLUMN tags TEXT DEFAULT '[]'`);
  } catch (e) {
    // Ignore error if column already exists
  }

  db.run(sql`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      author TEXT,
      summary TEXT,
      content_text TEXT,
      content_html TEXT,
      original_url TEXT,
      cover_image_url TEXT,
      read_count INTEGER,
      like_count INTEGER,
      comment_count INTEGER,
      audio_url TEXT,
      duration INTEGER,
      transcript_text TEXT,
      transcript_html TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_starred INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      fetched_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  try {
    db.run(sql`ALTER TABLE articles ADD COLUMN audio_url TEXT`);
  } catch (e) {
    // Ignore error if column already exists
  }

  try {
    db.run(sql`ALTER TABLE articles ADD COLUMN duration INTEGER`);
  } catch (e) {
    // Ignore error if column already exists
  }

  try {
    db.run(sql`ALTER TABLE articles ADD COLUMN transcript_text TEXT`);
  } catch (e) {
    // Ignore error if column already exists
  }

  try {
    db.run(sql`ALTER TABLE articles ADD COLUMN transcript_html TEXT`);
  } catch (e) {
    // Ignore error if column already exists
  }

  db.run(sql`
    CREATE TABLE IF NOT EXISTS ai_results (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      skill_type TEXT NOT NULL CHECK(skill_type IN ('summary', 'qa', 'mindmap')),
      model_used TEXT NOT NULL,
      prompt TEXT,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create indexes for performance
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_articles_is_read ON articles(is_read)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_articles_is_starred ON articles(is_starred)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_ai_results_article_id ON ai_results(article_id)`);

  console.log('✅ Database initialized successfully');
}

/**
 * Re-export getDatabase for convenient access in route handlers.
 */
export { getDatabase } from '@knowflow/db';
