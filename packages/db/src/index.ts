import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

let db: ReturnType<typeof createDatabase> | null = null;

function getDbPath(): string {
  const dataDir = process.env.KNOWFLOW_DATA_DIR || join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return join(dataDir, 'knowflow.db');
}

function createDatabase() {
  const dbPath = getDbPath();
  const sqlite = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  return drizzle(sqlite, { schema });
}

export function getDatabase() {
  if (!db) {
    db = createDatabase();
  }
  return db;
}

export { schema };
export * from './schema.js';
