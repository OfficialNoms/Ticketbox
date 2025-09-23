import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DATABASE_URL || path.join(DATA_DIR, 'ticketbox.sqlite');

export const db = new Database(DB_PATH);

// run schema (idempotent)
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  creator_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  subject TEXT,
  state TEXT NOT NULL CHECK (state IN ('OPEN','RESOLVED_PENDING_REVIEW','CLOSED','ARCHIVED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  closed_at INTEGER,
  archived_at INTEGER,
  added_participants TEXT,
  transcript_url TEXT,
  header_message_id TEXT
);

CREATE TABLE IF NOT EXISTS duty (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  is_on_duty INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

/* NEW: per-guild config */
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id TEXT PRIMARY KEY,
  moderator_role_ids TEXT,            -- JSON array of role IDs
  on_duty_role_id TEXT,               -- optional
  tickets_category_id TEXT,
  tickets_archive_category_id TEXT,
  log_channel_id TEXT,                -- existing logs, if you use them
  audit_log_channel_id TEXT,          -- NEW: channel where one-message-per-ticket lives
  fallback_ping_mod_if_no_on_duty INTEGER DEFAULT 1, -- 1=true, 0=false
  updated_at INTEGER NOT NULL
);
`);

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

/** Ensure a column exists; if missing, ALTER TABLE to add it. */
function ensureColumn(table: string, column: string, decl: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  const has = rows.some(r => r.name === column);
  if (!has) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}

/* Migrations for audit log */
ensureColumn('tickets', 'audit_message_id', 'TEXT');
ensureColumn('tickets', 'closed_by_user_id', 'TEXT');
ensureColumn('tickets', 'archived_by_user_id', 'TEXT');

// Lightweight helpers used by settings.ts
export const _getGuildConfig = db.prepare(`SELECT * FROM guild_config WHERE guild_id=?`);
export const _upsertGuildConfig = db.prepare(`
INSERT INTO guild_config (
  guild_id, moderator_role_ids, on_duty_role_id, tickets_category_id,
  tickets_archive_category_id, log_channel_id, audit_log_channel_id,
  fallback_ping_mod_if_no_on_duty, updated_at
) VALUES (
  @guild_id, @moderator_role_ids, @on_duty_role_id, @tickets_category_id,
  @tickets_archive_category_id, @log_channel_id, @audit_log_channel_id,
  @fallback_ping_mod_if_no_on_duty, @updated_at
)
ON CONFLICT(guild_id) DO UPDATE SET
  moderator_role_ids=excluded.moderator_role_ids,
  on_duty_role_id=excluded.on_duty_role_id,
  tickets_category_id=excluded.tickets_category_id,
  tickets_archive_category_id=excluded.tickets_archive_category_id,
  log_channel_id=excluded.log_channel_id,
  audit_log_channel_id=excluded.audit_log_channel_id,
  fallback_ping_mod_if_no_on_duty=excluded.fallback_ping_mod_if_no_on_duty,
  updated_at=excluded.updated_at
`);
