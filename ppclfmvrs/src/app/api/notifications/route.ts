import { connection } from "next/server";
import { handle, json, readJson, requireUser } from "@/lib/server/http";
import { listNotifications, markAllRead } from "@/lib/server/notifications";
import { getDb } from "@/lib/server/store";

export async function GET() {
  await connection();
  return handle(async () => {
    const user = await requireUser();
    return json(await listNotifications(await getDb(), user.id));
  });
}

/** Marks every notification as read. */
export async function POST(request: Request) {
  return handle(async () => {
    await readJson(request);
    const user = await requireUser();
    await markAllRead(await getDb(), user.id);
    return json({ ok: true });
  });
}
