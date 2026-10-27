import { clearedSessionCookie, deleteSession, readCookie, SESSION_COOKIE } from "@/lib/server/auth";
import { getDb } from "@/lib/server/context";
import { jsonError, sameOrigin } from "@/lib/server/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Cross-site request refused.", 403);
  await deleteSession(await getDb(), readCookie(request, SESSION_COOKIE));
  return Response.json({ ok: true }, { headers: { "set-cookie": clearedSessionCookie() } });
}
