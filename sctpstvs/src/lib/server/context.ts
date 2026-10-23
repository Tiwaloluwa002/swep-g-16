import path from "node:path";
import { type Db, openDatabase } from "@/lib/server/db";
import { loadOrCreateSigningKeys, type SigningKeys } from "@/lib/server/keys";

/** Runtime data (database and signing key) lives here; it is git-ignored. */
export function dataDir(): string {
  return process.env.SCT_DATA_DIR ?? path.join(process.cwd(), "data");
}

// Kept on globalThis so dev-mode hot reloads reuse one connection and one key.
const g = globalThis as unknown as { __sctDb?: Db; __sctKeys?: SigningKeys };

export function getDb(): Db {
  g.__sctDb ??= openDatabase(process.env.SCT_DB_FILE ?? path.join(dataDir(), "sctpstvs.db"));
  return g.__sctDb;
}

export function getKeys(): SigningKeys {
  g.__sctKeys ??= loadOrCreateSigningKeys(path.join(dataDir(), "keys"));
  return g.__sctKeys;
}
