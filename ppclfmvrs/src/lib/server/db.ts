import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PGlite, Transaction as PGliteTx } from "@electric-sql/pglite";
import type { Sql, TransactionSql } from "postgres";

/*
 * One Postgres database serves all of the group's apps; each app keeps its
 * tables in its own schema (this one: `ppclfmvrs`, or DATABASE_SCHEMA).
 * Production sets DATABASE_URL (e.g. Supabase's transaction pooler). Without
 * it, the app runs PGlite, Postgres compiled to WebAssembly and running
 * in-process: on disk under data/pglite for `npm run dev`, in memory for tests.
 *
 * SQL is written with `{schema}.table` names and `$1, $2…` placeholders. The
 * schema is substituted here, so nothing ever lands in `public` and no
 * session-level `search_path` is needed (poolers don't keep session state).
 */

export type Param = string | number | boolean | null;
export type Row = Record<string, unknown>;

/** The low-level operations both drivers provide. */
interface Driver {
  query(text: string, params: Param[]): Promise<{ rows: Row[]; count: number }>;
  begin<T>(fn: (tx: Driver) => Promise<T>): Promise<T>;
}

/**
 * A database handle bound to one schema. Inside `transaction`, use the `tx`
 * handle it passes for every query; a nested `transaction` call on `tx` joins
 * the outer one.
 */
export class Db {
  constructor(
    readonly schema: string,
    private readonly driver: Driver,
    private readonly inTransaction = false,
  ) {}

  async query<T = Row>(text: string, params: Param[] = []): Promise<T[]> {
    return (await this.driver.query(this.sql(text), params)).rows as T[];
  }

  /** Runs a statement and returns how many rows it changed. */
  async execute(text: string, params: Param[] = []): Promise<number> {
    return (await this.driver.query(this.sql(text), params)).count;
  }

  /** The same connection, bound to another schema (tests use one schema per test). */
  withSchema(schema: string): Db {
    return new Db(schema, this.driver, this.inTransaction);
  }

  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    if (this.inTransaction) return fn(this);
    return this.driver.begin((tx) => fn(new Db(this.schema, tx, true)));
  }

  private sql(text: string): string {
    return text.replaceAll("{schema}", this.schema);
  }
}

// ---------- Call-site helpers ----------

export function all(db: Db, sql: string, ...params: Param[]): Promise<Row[]> {
  return db.query(sql, params);
}

/** The first row, or undefined. */
export async function one(db: Db, sql: string, ...params: Param[]): Promise<Row | undefined> {
  return (await db.query(sql, params))[0];
}

/** Runs a statement and returns the number of rows it changed. */
export function run(db: Db, sql: string, ...params: Param[]): Promise<number> {
  return db.execute(sql, params);
}

/** A single integer from `SELECT COUNT(*)::int AS n …`. postgres.js returns bigint as a string, so always cast or Number() it. */
export async function count(db: Db, sql: string, ...params: Param[]): Promise<number> {
  return Number((await one(db, sql, ...params))?.n ?? 0);
}

/** timestamptz columns come back as Date objects; the app passes ISO strings around. */
export function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

export function isoOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value);
}

// ---------- Drivers ----------

function postgresDriver(sql: Sql | TransactionSql): Driver {
  return {
    async query(text, params) {
      const result = await sql.unsafe(text, params as never[]);
      return { rows: result as unknown as Row[], count: result.count ?? 0 };
    },
    begin(fn) {
      if (!("begin" in sql)) throw new Error("Nested transaction");
      return sql.begin((tx) => fn(postgresDriver(tx))) as Promise<never>;
    },
  };
}

function pgliteDriver(pg: PGlite | PGliteTx): Driver {
  return {
    async query(text, params) {
      const result = await pg.query<Row>(text, params);
      return { rows: result.rows, count: result.affectedRows ?? 0 };
    },
    begin(fn) {
      if (!("transaction" in pg)) throw new Error("Nested transaction");
      return pg.transaction((tx) => fn(pgliteDriver(tx)));
    },
  };
}

/** Reads DATABASE_SCHEMA (default `ppclfmvrs`). Only plain identifiers are allowed, since the name is put into SQL. */
export function schemaFromEnv(): string {
  const schema = process.env.DATABASE_SCHEMA || "ppclfmvrs";
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) throw new Error(`Invalid DATABASE_SCHEMA "${schema}": use lowercase letters, digits and _.`);
  return schema;
}

/** TLS unless the URL is local or says sslmode=disable. */
function needsSsl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.searchParams.get("sslmode") === "disable") return false;
    return !["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
  } catch {
    return true;
  }
}

/** A postgres.js client sized for serverless: a few connections, no prepared statements (PgBouncer/Supavisor transaction mode). */
export async function connectPostgres(url: string, schema = schemaFromEnv()): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    max: 5,
    prepare: false,
    ssl: needsSsl(url) ? "require" : false,
    idle_timeout: 20,
    onnotice: () => {},
  });
  return new Db(schema, postgresDriver(sql));
}

/** PGlite on disk (dir) or in memory (no dir). */
export async function connectPglite(dir?: string, schema = schemaFromEnv()): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dir) mkdirSync(path.dirname(dir), { recursive: true });
  const pg = dir ? new PGlite(dir) : new PGlite();
  await pg.waitReady;
  return new Db(schema, pgliteDriver(pg));
}

// ---------- Schema ----------

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS {schema}.users (
  id text PRIMARY KEY,
  ident text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('member', 'desk', 'admin')),
  desk_id text,
  phone text,
  email text,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS {schema}.sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES {schema}.users(id),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expires ON {schema}.sessions (expires_at);
CREATE TABLE IF NOT EXISTS {schema}.lost_items (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES {schema}.users(id),
  category text NOT NULL,
  colour text NOT NULL,
  brand text NOT NULL,
  description text NOT NULL,
  location_id text NOT NULL,
  lost_date text NOT NULL,
  time_from text NOT NULL,
  time_to text NOT NULL,
  private_json text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS lost_items_owner ON {schema}.lost_items (owner_id);
CREATE INDEX IF NOT EXISTS lost_items_open ON {schema}.lost_items (status, category);
CREATE TABLE IF NOT EXISTS {schema}.found_items (
  id text PRIMARY KEY,
  finder_id text NOT NULL REFERENCES {schema}.users(id),
  category text NOT NULL,
  colour text NOT NULL,
  location_id text NOT NULL,
  found_date text NOT NULL,
  description text NOT NULL,
  custody text NOT NULL CHECK (custody IN ('desk', 'finder')),
  desk_id text,
  meet_location_id text,
  received_at timestamptz,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS found_items_finder ON {schema}.found_items (finder_id);
CREATE INDEX IF NOT EXISTS found_items_open ON {schema}.found_items (status, category);
CREATE TABLE IF NOT EXISTS {schema}.questions (
  id text PRIMARY KEY,
  found_id text NOT NULL REFERENCES {schema}.found_items(id),
  position integer NOT NULL,
  question text NOT NULL,
  salt text NOT NULL,
  answer_hash text NOT NULL
);
CREATE INDEX IF NOT EXISTS questions_found ON {schema}.questions (found_id);
CREATE TABLE IF NOT EXISTS {schema}.matches (
  lost_id text NOT NULL REFERENCES {schema}.lost_items(id),
  found_id text NOT NULL REFERENCES {schema}.found_items(id),
  score double precision NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (lost_id, found_id)
);
CREATE INDEX IF NOT EXISTS matches_found ON {schema}.matches (found_id);
CREATE TABLE IF NOT EXISTS {schema}.claims (
  id text PRIMARY KEY,
  lost_id text NOT NULL REFERENCES {schema}.lost_items(id),
  found_id text NOT NULL REFERENCES {schema}.found_items(id),
  claimant_id text NOT NULL REFERENCES {schema}.users(id),
  status text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (lost_id, found_id)
);
CREATE INDEX IF NOT EXISTS claims_claimant ON {schema}.claims (claimant_id);
CREATE INDEX IF NOT EXISTS claims_found ON {schema}.claims (found_id);
CREATE TABLE IF NOT EXISTS {schema}.claim_attempts (
  id text PRIMARY KEY,
  claim_id text NOT NULL REFERENCES {schema}.claims(id),
  user_id text NOT NULL REFERENCES {schema}.users(id),
  success boolean NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS claim_attempts_user ON {schema}.claim_attempts (user_id, created_at);
CREATE TABLE IF NOT EXISTS {schema}.handover_codes (
  id text PRIMARY KEY,
  claim_id text NOT NULL REFERENCES {schema}.claims(id),
  code_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by text REFERENCES {schema}.users(id),
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS handover_codes_claim ON {schema}.handover_codes (claim_id);
CREATE TABLE IF NOT EXISTS {schema}.notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES {schema}.users(id),
  message text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user ON {schema}.notifications (user_id, created_at);
CREATE TABLE IF NOT EXISTS {schema}.login_failures (
  id text PRIMARY KEY,
  ident text NOT NULL,
  ip text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS login_failures_ident ON {schema}.login_failures (ident, created_at);
CREATE INDEX IF NOT EXISTS login_failures_ip ON {schema}.login_failures (ip, created_at);
`;

/**
 * Creates the schema and tables if missing. Idempotent, and safe when several
 * server instances start at once: the transaction-scoped advisory lock makes
 * them take turns (concurrent CREATE … IF NOT EXISTS can otherwise collide).
 */
export async function migrate(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${tx.schema}:migrate`]);
    await tx.query(`CREATE SCHEMA IF NOT EXISTS ${tx.schema}`);
    // One statement per call: the extended query protocol (used with parameters and poolers) runs one at a time.
    for (const statement of MIGRATIONS.split(";").map((s) => s.trim()).filter(Boolean)) {
      await tx.query(statement);
    }
  });
}
