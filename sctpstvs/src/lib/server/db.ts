import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { seedDemoData } from "@/lib/server/seed";

export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  matric TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'conductor', 'admin')),
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  fare_kobo INTEGER NOT NULL CHECK (fare_kobo > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  route_id INTEGER REFERENCES routes(id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  short_code TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  route_id INTEGER NOT NULL REFERENCES routes(id),
  fare_kobo INTEGER NOT NULL CHECK (fare_kobo > 0),
  token TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'refunded')),
  redeemed_at INTEGER,
  redeemed_by INTEGER REFERENCES users(id),
  redeemed_vehicle TEXT
);
CREATE INDEX IF NOT EXISTS tickets_user ON tickets(user_id, issued_at);

-- The wallet is an append-only ledger; a balance is always SUM(amount_kobo).
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('topup', 'purchase', 'refund')),
  amount_kobo INTEGER NOT NULL CHECK ((kind = 'purchase' AND amount_kobo < 0) OR (kind <> 'purchase' AND amount_kobo > 0)),
  ticket_id TEXT REFERENCES tickets(id),
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_user ON ledger(user_id);

CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger
BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger
BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
-- Last line of defence: even a buggy caller cannot push a balance below zero.
CREATE TRIGGER IF NOT EXISTS ledger_no_negative BEFORE INSERT ON ledger
WHEN (SELECT COALESCE(SUM(amount_kobo), 0) FROM ledger WHERE user_id = NEW.user_id) + NEW.amount_kobo < 0
BEGIN SELECT RAISE(ABORT, 'insufficient funds'); END;

CREATE TABLE IF NOT EXISTS fraud_log (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  ticket_id TEXT,
  actor_id INTEGER REFERENCES users(id),
  vehicle TEXT,
  ip TEXT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS fraud_at ON fraud_log(at);
`;

export function openDatabase(file: string, { seed = true } = {}): Db {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  if (seed) seedDemoData(db);
  return db;
}

/**
 * Runs fn inside BEGIN IMMEDIATE, which takes SQLite's write lock up front.
 * Any other connection (another worker or process) waits for us to finish,
 * so a read-check-write inside fn cannot interleave with another writer.
 */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** node:sqlite returns null-prototype rows; this narrows them for callers. */
export function row<T>(value: unknown): T | undefined {
  return (value ?? undefined) as T | undefined;
}
