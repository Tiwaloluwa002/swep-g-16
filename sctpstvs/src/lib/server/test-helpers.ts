import { randomBytes } from "node:crypto";
import { connectPostgres, type Db, DEFAULT_SCHEMA, migrate, openPglite, pgliteImage } from "@/lib/server/db";
import { generateSigningKeys } from "@/lib/server/keys";

/*
 * Each test gets a fresh, seeded database:
 * - by default an in-memory PGlite copied from one migrated image per test file;
 * - with DATABASE_URL set, a new throwaway schema (sct_test_…) on that real
 *   Postgres server, with a pool of several connections so concurrency tests
 *   race for real. vitest.global-setup.ts drops those schemas afterwards.
 */
export const TEST_SCHEMA_PREFIX = "sct_test_";

let image: Promise<File | Blob> | undefined;

export async function testDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const db = await connectPostgres(url, `${TEST_SCHEMA_PREFIX}${randomBytes(5).toString("hex")}`, { max: 10, idleTimeout: 1 });
    await migrate(db);
    return db;
  }
  image ??= pgliteImage(DEFAULT_SCHEMA);
  return openPglite(DEFAULT_SCHEMA, { image: await image });
}

/**
 * A second, independent connection to the same database, like another server
 * process. PGlite runs in-process and allows only one connection, so there it
 * returns the same handle.
 */
export async function secondConnection(db: Db): Promise<Db> {
  const url = process.env.DATABASE_URL;
  return url ? connectPostgres(url, db.schema, { max: 2, idleTimeout: 1 }) : db;
}

/**
 * Opens n pooled connections (real Postgres only) so that the requests a
 * concurrency test fires next really overlap instead of queueing for a
 * connection handshake.
 */
export async function warmPool(db: Db, n = 10): Promise<void> {
  if (process.env.DATABASE_URL) await Promise.all(Array.from({ length: n }, () => db.query("SELECT pg_sleep(0.05)")));
}

export const testKeys = generateSigningKeys();

export async function userId(db: Db, matric: string): Promise<number> {
  return (await db.one<{ id: number }>("SELECT id FROM {schema}.users WHERE upper(matric) = upper($1)", [matric])).id;
}

export async function routeId(db: Db, name: string): Promise<number> {
  return (await db.one<{ id: number }>("SELECT id FROM {schema}.routes WHERE name = $1", [name])).id;
}

export const RICH = "CSC/2021/001"; // ₦2,000 seeded
export const POOR = "EEG/2022/014"; // ₦100 seeded, below every demo fare
export const CONDUCTOR = "CON/001";
