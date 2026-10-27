import { randomUUID } from "node:crypto";
import type { Notification } from "@/lib/types";
import { all, count, type Db, iso, run } from "./db";

export async function notify(db: Db, userId: string, message: string, link: string | null = null, now = new Date()): Promise<void> {
  await run(
    db,
    "INSERT INTO {schema}.notifications (id, user_id, message, link, read, created_at) VALUES ($1, $2, $3, $4, false, $5)",
    randomUUID(),
    userId,
    message,
    link,
    now.toISOString(),
  );
}

export async function listNotifications(db: Db, userId: string, limit = 30): Promise<Notification[]> {
  const rows = await all(db, "SELECT * FROM {schema}.notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2", userId, limit);
  return rows.map((r) => ({
    id: String(r.id),
    message: String(r.message),
    link: (r.link as string | null) ?? null,
    read: r.read === true,
    createdAt: iso(r.created_at),
  }));
}

export function unreadCount(db: Db, userId: string): Promise<number> {
  return count(db, "SELECT COUNT(*)::int AS n FROM {schema}.notifications WHERE user_id = $1 AND NOT read", userId);
}

export async function markAllRead(db: Db, userId: string): Promise<void> {
  await run(db, "UPDATE {schema}.notifications SET read = true WHERE user_id = $1", userId);
}
