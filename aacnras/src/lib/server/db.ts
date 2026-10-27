import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import type { Sql } from "postgres";

/*
 * One Postgres database serves all of the group's apps; each app keeps its
 * tables in its own schema. Production sets DATABASE_URL. Without it, the app
 * uses PGlite (Postgres in-process): on disk for `npm run dev`, in memory for tests.
 */
const SCHEMA = process.env.DATABASE_SCHEMA ?? "aacnras";
if (!/^[a-z_][a-z0-9_]*$/.test(SCHEMA)) throw new Error(`Invalid DATABASE_SCHEMA "${SCHEMA}"`);

type Runner = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

const MIGRATIONS = `
  CREATE SCHEMA IF NOT EXISTS ${SCHEMA};
  CREATE TABLE IF NOT EXISTS ${SCHEMA}.reports (
    id text PRIMARY KEY,
    type text NOT NULL,
    description text NOT NULL DEFAULT '',
    edge_id text,
    place_id text,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS reports_created_at ON ${SCHEMA}.reports (created_at);
`;

async function connectPostgres(url: string): Promise<Runner> {
  const { default: postgres } = await import("postgres");
  const local = /localhost|127\.0\.0\.1|sslmode=disable/.test(url);
  // prepare: false keeps the client compatible with PgBouncer-style poolers.
  const sql: Sql = postgres(url, { max: 5, prepare: false, ssl: local ? false : "require", onnotice: () => {} });
  await sql.unsafe(MIGRATIONS);
  return async (text, params = []) => (await sql.unsafe(text, params as never[])) as unknown as Record<string, unknown>[];
}

async function connectPglite(): Promise<Runner> {
  const { PGlite } = await import("@electric-sql/pglite");
  const inMemory = Boolean(process.env.VITEST);
  const db: PGlite = inMemory ? new PGlite() : new PGlite(path.join(process.cwd(), "data", "pglite"));
  await db.exec(MIGRATIONS);
  return async (text, params = []) => (await db.query<Record<string, unknown>>(text, params)).rows;
}

// Cached on globalThis so Next's dev reloads don't open a new connection each time.
const cache = globalThis as unknown as { __aacnrasDb?: Promise<Runner> };

function runner(): Promise<Runner> {
  cache.__aacnrasDb ??= process.env.DATABASE_URL ? connectPostgres(process.env.DATABASE_URL) : connectPglite();
  return cache.__aacnrasDb;
}

/** Runs one parameterised statement ($1, $2…) and returns its rows. Table names take the `{schema}` prefix. */
export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const run = await runner();
  return (await run(text.replaceAll("{schema}", SCHEMA), params)) as T[];
}

/** Test helper: forget the connection so the next query starts a fresh in-memory database. */
export function resetDbForTests() {
  delete cache.__aacnrasDb;
}
