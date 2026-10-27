import path from "node:path";
import { connectPglite, connectPostgres, type Db, migrate } from "./db";
import { seedIfEmpty } from "./seed";

/*
 * One database handle per server process, created on first use: connect,
 * migrate, then seed the demo data if the tables are empty. The promise is
 * kept on globalThis so Next's dev reloads reuse it instead of opening new
 * connections. If startup fails, the next request tries again.
 */
const globalStore = globalThis as unknown as { __ppclDb?: Promise<Db> };

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (!url && process.env.NODE_ENV === "production") {
    console.warn("DATABASE_URL is not set: using a local PGlite database under data/pglite. Set DATABASE_URL for any shared or serverless deployment.");
  }
  const db = url ? await connectPostgres(url) : await connectPglite(path.join(process.cwd(), "data", "pglite"));
  await migrate(db);
  await seedIfEmpty(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!globalStore.__ppclDb) {
    globalStore.__ppclDb = open().catch((err) => {
      globalStore.__ppclDb = undefined;
      throw err;
    });
  }
  return globalStore.__ppclDb;
}
