import { connection } from "next/server";
import { getStats, listDeskItems, listFailedAttempts } from "@/lib/server/desk";
import { handle, json, requireUser } from "@/lib/server/http";
import { getDb } from "@/lib/server/store";

export async function GET() {
  await connection();
  return handle(async () => {
    const user = await requireUser("desk", "admin");
    const db = getDb();
    return json({ items: listDeskItems(db, user), failedAttempts: listFailedAttempts(db, user), stats: getStats(db) });
  });
}
