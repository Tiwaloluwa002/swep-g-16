import { connection } from "next/server";
import { currentUser, handle, json } from "@/lib/server/http";
import { unreadCount } from "@/lib/server/notifications";
import { sessionUser } from "@/lib/server/serialize";
import { getDb } from "@/lib/server/store";

export async function GET() {
  await connection();
  return handle(async () => {
    const user = await currentUser();
    if (!user) return json({ user: null, unread: 0 });
    const unread = await unreadCount(await getDb(), user.id);
    return json({ user: sessionUser(user), unread });
  });
}
