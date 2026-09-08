import DatabaseConstructor, { Database } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export function getDatabasePath(): string {
  const envPath = process.env.CANYWHERE_DB_PATH;
  if (envPath) return envPath;
  const dir = path.join(os.homedir(), ".canywhere");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, "canywhere.db");
}

export function initDatabase(dbPath: string = getDatabasePath()): Database {
  const db = new DatabaseConstructor(dbPath);

  // Invariants: Unconditionally enable WAL mode and foreign keys
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);

  return db;
}

function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      root_path TEXT NOT NULL,
      sub_paths_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      provider TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      thread_id TEXT,
      model TEXT,
      scratch_dir TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      turn_id TEXT,
      sequence INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS message_blocks (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL,
      block_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'done',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS approval_requests (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      message_id TEXT,
      turn_id TEXT,
      call_id TEXT NOT NULL,
      approval_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      status TEXT NOT NULL,
      decision TEXT,
      created_at INTEGER NOT NULL,
      decided_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      public_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      paired_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      revoked_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS pairing_sessions (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      secret TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chats_workspace_id ON chats(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_message_blocks_message_id ON message_blocks(message_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_chat_id ON approval_requests(chat_id);
    CREATE INDEX IF NOT EXISTS idx_devices_public_key ON devices(public_key);
    CREATE INDEX IF NOT EXISTS idx_pairing_token ON pairing_sessions(token);
  `);
}
