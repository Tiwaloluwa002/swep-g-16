import { cookies } from "next/headers";
import { handle, json, readJson, SESSION_COOKIE, sessionToken } from "@/lib/server/http";
import { getDb } from "@/lib/server/store";
import { deleteSession } from "@/lib/server/users";

export async function POST(request: Request) {
  return handle(async () => {
    await readJson(request);
    const token = await sessionToken();
    if (token) await deleteSession(await getDb(), token);
    (await cookies()).delete(SESSION_COOKIE);
    return json({ ok: true });
  });
}
