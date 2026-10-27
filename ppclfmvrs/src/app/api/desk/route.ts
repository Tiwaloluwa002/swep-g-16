import { connection } from "next/server";
import { getStats, listDeskItems, listFailedAttempts } from "@/lib/server/desk";
import { handle, json, requireUser } from "@/lib/server/http";
import { getDb } from "@/lib/server/store";

export async function GET() {
  await connection();
  return handle(async () => {
    const user = await requireUser("desk", "admin");
    const db = await getDb();
    const [items, failedAttempts, stats] = await Promise.all([listDeskItems(db, user), listFailedAttempts(db, user), getStats(db)]);
    return json({ items, failedAttempts, stats });
  });
}
