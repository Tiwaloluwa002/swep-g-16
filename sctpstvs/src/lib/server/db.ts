import path from "node:path";
import type { PGlite, Transaction as PgliteTx } from "@electric-sql/pglite";
import type { Sql, TransactionSql } from "postgres";
import { seedDemoData } from "@/lib/server/seed";

/*
 * One Postgres database serves all of the group's apps; each app keeps its
 * tables in its own schema (this one: DATABASE_SCHEMA, default "sctpstvs").
 * Production sets DATABASE_URL (for Supabase, the transaction pooler URL).
 * Without it the app uses PGlite, Postgres compiled to WebAssembly and run
 * in-process: on disk under data/pglite for `npm run dev`, in memory for tests.
 *
 * Every table is schema-qualified. SQL in this app writes `{schema}.tickets`
 * and the adapter fills in the schema, so nothing depends on search_path
 * (which transaction poolers such as PgBouncer and Supavisor do not keep).
 */

export const DEFAULT_SCHEMA = "sctpstvs";

export function schemaFromEnv(): string {
  const schema = process.env.DATABASE_SCHEMA || DEFAULT_SCHEMA;
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`Invalid DATABASE_SCHEMA "${schema}"`);
  return schema;
}

export interface Db {
  readonly schema: string;
  /** Runs one parameterised statement ($1, $2…) and returns its rows. */
  query<T>(text: string, params?: unknown[]): Promise<T[]>;
  /** The first row, or an error if there is none. */
  one<T>(text: string, params?: unknown[]): Promise<T>;
  /** The first row, or undefined. */
  maybeOne<T>(text: string, params?: unknown[]): Promise<T | undefined>;
  /**
   * Runs fn inside BEGIN … COMMIT (ROLLBACK if it throws). Inside a
   * transaction this just calls fn with the same transaction.
   */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  /** Runs several statements without parameters (migrations only). */
  exec(text: string): Promise<void>;
  /** Closes the connection (tests and scripts). */
  close(): Promise<void>;
}

type Runner = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

interface Driver {
  run: Runner;
  exec(text: string): Promise<void>;
  begin<T>(fn: (driver: Driver) => Promise<T>): Promise<T> | null;
  close(): Promise<void>;
}

function makeDb(schema: string, driver: Driver): Db {
  const fill = (text: string) => text.replaceAll("{schema}", schema);
  const db: Db = {
    schema,
    query: async <T>(text: string, params: unknown[] = []) => (await driver.run(fill(text), params)) as T[],
    one: async <T>(text: string, params: unknown[] = []) => {
      const [row] = await db.query<T>(text, params);
      if (row === undefined) throw new Error("Expected a row, got none");
      return row;
    },
    maybeOne: async <T>(text: string, params: unknown[] = []) => (await db.query<T>(text, params))[0],
    transaction: <T>(fn: (tx: Db) => Promise<T>) => driver.begin((inner) => fn(makeDb(schema, inner))) ?? fn(db),
    exec: (text: string) => driver.exec(fill(text)),
    close: () => driver.close(),
  };
  return db;
}

// ---------------------------------------------------------------- postgres.js

function postgresDriver(sql: Sql | TransactionSql, inTx: boolean): Driver {
  return {
    run: async (text, params) => (await sql.unsafe(text, params as never[])) as unknown as Record<string, unknown>[],
    exec: async (text) => {
      await sql.unsafe(text);
    },
    begin: (fn) => (inTx ? null : (sql as Sql).begin((tx) => fn(postgresDriver(tx, true))) as Promise<never>),
    close: async () => {
      if (!inTx) await (sql as Sql).end({ timeout: 5 });
    },
  };
}

/** Connects to a real Postgres server (Supabase, Neon or local). */
export async function connectPostgres(
  url: string,
  schema: string,
  { max = 5, idleTimeout }: { max?: number; idleTimeout?: number } = {},
): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const { hostname, searchParams } = new URL(url);
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname) || searchParams.get("sslmode") === "disable";
  const sql = postgres(url, {
    max,
    idle_timeout: idleTimeout,
    // Poolers in transaction mode (Supabase port 6543, Neon -pooler) cannot keep prepared statements.
    prepare: false,
    ssl: local ? false : "require",
    onnotice: () => {},
    // Kobo amounts, ids and counts are int8; they all fit safely in a JS number.
    types: { int8: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) } },
  });
  return makeDb(schema, postgresDriver(sql, false));
}

// --------------------------------------------------------------------- PGlite

const PGLITE_OPTIONS = { parsers: { 20: (x: string) => Number(x) } };

function pgliteDriver(pg: PGlite | PgliteTx, owner: PGlite | null): Driver {
  return {
    run: async (text, params) => (await pg.query<Record<string, unknown>>(text, params, PGLITE_OPTIONS)).rows,
    exec: async (text) => {
      await pg.exec(text);
    },
    begin: (fn) => (owner ? owner.transaction((tx) => fn(pgliteDriver(tx, null))) : null),
    close: async () => {
      if (owner) await owner.close();
    },
  };
}

/** Opens PGlite: persistent if dataDir is given, otherwise in memory (optionally from a dumped image). */
export async function openPglite(
  schema: string,
  { dataDir, image }: { dataDir?: string; image?: File | Blob } = {},
): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = await PGlite.create({ ...PGLITE_OPTIONS, ...(dataDir ? { dataDir } : {}), ...(image ? { loadDataDir: image } : {}) });
  return makeDb(schema, pgliteDriver(pg, pg));
}

/** A migrated, seeded in-memory PGlite database as an image, so tests can start copies of it quickly. */
export async function pgliteImage(schema: string): Promise<File | Blob> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = await PGlite.create(PGLITE_OPTIONS);
  await migrate(makeDb(schema, pgliteDriver(pg, pg)));
  const image = await pg.dumpDataDir("none");
  await pg.close();
  return image;
}

// ----------------------------------------------------------------- migrations

const MIGRATIONS = `
CREATE SCHEMA IF NOT EXISTS {schema};

CREATE TABLE IF NOT EXISTS {schema}.users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  matric text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('student', 'conductor', 'admin')),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Matric and staff numbers are case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS users_matric ON {schema}.users (upper(matric));

-- Only a SHA-256 hash of each session token is stored.
CREATE TABLE IF NOT EXISTS {schema}.sessions (
  token_hash text PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES {schema}.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expires ON {schema}.sessions (expires_at);

CREATE TABLE IF NOT EXISTS {schema}.routes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  fare_kobo bigint NOT NULL CHECK (fare_kobo > 0),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS {schema}.vehicles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  route_id bigint REFERENCES {schema}.routes(id)
);

CREATE TABLE IF NOT EXISTS {schema}.tickets (
  id text PRIMARY KEY,
  short_code text NOT NULL UNIQUE,
  user_id bigint NOT NULL REFERENCES {schema}.users(id),
  route_id bigint NOT NULL REFERENCES {schema}.routes(id),
  fare_kobo bigint NOT NULL CHECK (fare_kobo > 0),
  token text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'refunded')),
  redeemed_at timestamptz,
  redeemed_by bigint REFERENCES {schema}.users(id),
  redeemed_vehicle text
);
CREATE INDEX IF NOT EXISTS tickets_user ON {schema}.tickets (user_id, issued_at);
CREATE INDEX IF NOT EXISTS tickets_issued ON {schema}.tickets (issued_at);

-- The wallet is an append-only ledger; a balance is always SUM(amount_kobo).
CREATE TABLE IF NOT EXISTS {schema}.ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES {schema}.users(id),
  kind text NOT NULL CHECK (kind IN ('topup', 'purchase', 'refund')),
  amount_kobo bigint NOT NULL CHECK ((kind = 'purchase' AND amount_kobo < 0) OR (kind <> 'purchase' AND amount_kobo > 0)),
  ticket_id text REFERENCES {schema}.tickets(id),
  note text,
  created_by bigint REFERENCES {schema}.users(id),
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_user ON {schema}.ledger (user_id);

CREATE OR REPLACE FUNCTION {schema}.ledger_append_only() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'ledger is append-only' USING ERRCODE = 'restrict_violation';
END
$fn$;

-- Last line of defence: even a buggy caller or a direct INSERT cannot push a
-- balance below zero. Locking the owner's users row first serialises every
-- write to one wallet, so two concurrent debits cannot both pass the check.
CREATE OR REPLACE FUNCTION {schema}.ledger_no_negative() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  balance bigint;
BEGIN
  PERFORM 1 FROM {schema}.users WHERE id = NEW.user_id FOR NO KEY UPDATE;
  SELECT COALESCE(SUM(amount_kobo), 0) INTO balance FROM {schema}.ledger WHERE user_id = NEW.user_id;
  IF balance + NEW.amount_kobo < 0 THEN
    RAISE EXCEPTION 'insufficient funds' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$fn$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = '{schema}.ledger'::regclass AND tgname = 'ledger_no_update_delete') THEN
    CREATE TRIGGER ledger_no_update_delete BEFORE UPDATE OR DELETE ON {schema}.ledger
      FOR EACH ROW EXECUTE FUNCTION {schema}.ledger_append_only();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = '{schema}.ledger'::regclass AND tgname = 'ledger_no_truncate') THEN
    CREATE TRIGGER ledger_no_truncate BEFORE TRUNCATE ON {schema}.ledger
      FOR EACH STATEMENT EXECUTE FUNCTION {schema}.ledger_append_only();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = '{schema}.ledger'::regclass AND tgname = 'ledger_no_negative') THEN
    CREATE TRIGGER ledger_no_negative BEFORE INSERT ON {schema}.ledger
      FOR EACH ROW EXECUTE FUNCTION {schema}.ledger_no_negative();
  END IF;
END
$do$;

CREATE TABLE IF NOT EXISTS {schema}.fraud_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL,
  kind text NOT NULL,
  ticket_id text,
  actor_id bigint REFERENCES {schema}.users(id),
  vehicle text,
  ip text,
  detail text
);
CREATE INDEX IF NOT EXISTS fraud_at ON {schema}.fraud_log (at);

-- Sliding-window rate limits, shared by every server instance.
CREATE TABLE IF NOT EXISTS {schema}.rate_limit_hits (
  key text NOT NULL,
  at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limit_hits_key ON {schema}.rate_limit_hits (key, at);
CREATE INDEX IF NOT EXISTS rate_limit_hits_at ON {schema}.rate_limit_hits (at);
`;

/**
 * Creates the schema, tables and triggers if they are missing, then seeds an
 * empty database. Everything runs in one transaction behind an advisory lock,
 * so two instances starting together cannot race each other.
 */
export async function migrate(db: Db, { seed = true } = {}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${tx.schema}:migrate`]);
    await tx.exec(MIGRATIONS);
    if (seed) await seedDemoData(tx);
  });
}

// ------------------------------------------------------------ app connection

export function dataDir(): string {
  return process.env.SCT_DATA_DIR ?? path.join(process.cwd(), "data");
}

async function openAppDb(): Promise<Db> {
  const schema = schemaFromEnv();
  const url = process.env.DATABASE_URL;
  let db: Db;
  if (url) {
    db = await connectPostgres(url, schema);
  } else {
    if (process.env.NODE_ENV === "production" && !process.env.VITEST) {
      console.warn("DATABASE_URL is not set: using the local PGlite database in data/pglite. Set it in production.");
    }
    db = await openPglite(schema, { dataDir: process.env.VITEST ? undefined : path.join(dataDir(), "pglite") });
  }
  await migrate(db);
  return db;
}

// Cached on globalThis so Next dev reloads reuse one client, and migrations run once per process.
const cache = globalThis as unknown as { __sctpstvsDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!cache.__sctpstvsDb) {
    cache.__sctpstvsDb = openAppDb();
    // A failed start (database down, bad URL) is retried on the next request.
    cache.__sctpstvsDb.catch(() => delete cache.__sctpstvsDb);
  }
  return cache.__sctpstvsDb;
}

// ------------------------------------------------------------------- helpers

/** Postgres timestamps come back as Date objects; the app passes epoch milliseconds around. */
export function ms(value: unknown): number {
  return value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : Number(value);
}

export function msOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : ms(value);
}

/** Epoch milliseconds to a timestamptz parameter. */
export const ts = (epochMs: number): Date => new Date(epochMs);

/** Postgres error code of a failed query, e.g. "23505" for a unique violation. */
export function pgCode(err: unknown): string | undefined {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}
