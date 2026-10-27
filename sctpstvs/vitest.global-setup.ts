import { connectPostgres } from "./src/lib/server/db";

/** With DATABASE_URL set, tests create sct_test_… schemas on that server; drop them when the run ends. */
export default function setup() {
  return async () => {
    const url = process.env.DATABASE_URL;
    if (!url) return;
    const db = await connectPostgres(url, "public", { max: 1 });
    const rows = await db.query<{ nspname: string }>(
      "SELECT nspname FROM pg_namespace WHERE nspname LIKE 'sct\\_test\\_%'",
    );
    for (const { nspname } of rows) await db.query(`DROP SCHEMA ${nspname} CASCADE`);
    await db.close();
  };
}
