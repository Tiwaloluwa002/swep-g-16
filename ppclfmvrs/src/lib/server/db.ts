import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  ident TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('member', 'desk', 'admin')),
  desk_id TEXT,
  phone TEXT,
  email TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lost_items (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,
  colour TEXT NOT NULL,
  brand TEXT NOT NULL,
  description TEXT NOT NULL,
  location_id TEXT NOT NULL,
  lost_date TEXT NOT NULL,
  time_from TEXT NOT NULL,
  time_to TEXT NOT NULL,
  private_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS found_items (
  id TEXT PRIMARY KEY,
  finder_id TEXT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,
  colour TEXT NOT NULL,
  location_id TEXT NOT NULL,
  found_date TEXT NOT NULL,
  description TEXT NOT NULL,
  custody TEXT NOT NULL CHECK (custody IN ('desk', 'finder')),
  desk_id TEXT,
  meet_location_id TEXT,
  received_at TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  found_id TEXT NOT NULL REFERENCES found_items(id),
  position INTEGER NOT NULL,
  question TEXT NOT NULL,
  salt TEXT NOT NULL,
  answer_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS matches (
  lost_id TEXT NOT NULL REFERENCES lost_items(id),
  found_id TEXT NOT NULL REFERENCES found_items(id),
  score REAL NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (lost_id, found_id)
);
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  lost_id TEXT NOT NULL REFERENCES lost_items(id),
  found_id TEXT NOT NULL REFERENCES found_items(id),
  claimant_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (lost_id, found_id)
);
CREATE TABLE IF NOT EXISTS claim_attempts (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES claims(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  success INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS claim_attempts_user ON claim_attempts (user_id, created_at);
CREATE TABLE IF NOT EXISTS handover_codes (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES claims(id),
  code_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by TEXT REFERENCES users(id),
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  link TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`;

export function openDatabase(file: string): Db {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
}

/** Runs fn in a transaction; node:sqlite is synchronous, so nothing interleaves. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export type Row = Record<string, unknown>;

export function all(db: Db, sql: string, ...params: (string | number | null)[]): Row[] {
  return db.prepare(sql).all(...params) as Row[];
}

export function one(db: Db, sql: string, ...params: (string | number | null)[]): Row | undefined {
  return db.prepare(sql).get(...params) as Row | undefined;
}

export function run(db: Db, sql: string, ...params: (string | number | null)[]): number {
  return Number(db.prepare(sql).run(...params).changes);
}
