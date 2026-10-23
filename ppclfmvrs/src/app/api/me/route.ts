import { connection } from "next/server";
import { one } from "@/lib/server/db";
import { currentUser, handle, json } from "@/lib/server/http";
import { sessionUser } from "@/lib/server/serialize";
import { getDb } from "@/lib/server/store";

export async function GET() {
  await connection();
  return handle(async () => {
    const user = await currentUser();
    if (!user) return json({ user: null, unread: 0 });
    const unread = Number(one(getDb(), "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0", user.id)!.n);
    return json({ user: sessionUser(user), unread });
  });
}
