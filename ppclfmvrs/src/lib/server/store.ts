import path from "node:path";
import { type Db, openDatabase } from "./db";
import { seedIfEmpty } from "./seed";

/*
 * One SQLite file for the whole app. node:sqlite is synchronous, so a
 * single process never interleaves writes. Kept on globalThis so dev-mode
 * reloads reuse the connection.
 */
const globalStore = globalThis as unknown as { ppclDb?: Db };

export function getDb(): Db {
  if (!globalStore.ppclDb) {
    const file = process.env.PPCL_DB_PATH ?? path.join(process.cwd(), "data", "ppclfmvrs.db");
    const db = openDatabase(file);
    seedIfEmpty(db);
    globalStore.ppclDb = db;
  }
  return globalStore.ppclDb;
}
