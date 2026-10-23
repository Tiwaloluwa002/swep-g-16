import { randomUUID } from "node:crypto";
import type { Notification } from "@/lib/types";
import { all, type Db, run } from "./db";

export function notify(db: Db, userId: string, message: string, link: string | null = null, now = new Date()): void {
  run(
    db,
    "INSERT INTO notifications (id, user_id, message, link, read, created_at) VALUES (?, ?, ?, ?, 0, ?)",
    randomUUID(),
    userId,
    message,
    link,
    now.toISOString(),
  );
}

export function listNotifications(db: Db, userId: string, limit = 30): Notification[] {
  return all(db, "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", userId, limit).map(
    (r) => ({
      id: String(r.id),
      message: String(r.message),
      link: (r.link as string | null) ?? null,
      read: Number(r.read) === 1,
      createdAt: String(r.created_at),
    }),
  );
}

export function markAllRead(db: Db, userId: string): void {
  run(db, "UPDATE notifications SET read = 1 WHERE user_id = ?", userId);
}
