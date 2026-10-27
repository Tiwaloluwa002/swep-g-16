import { cookies } from "next/headers";
import { clientIp, handle, HttpError, json, readJson, SESSION_COOKIE } from "@/lib/server/http";
import { sessionUser } from "@/lib/server/serialize";
import { getDb } from "@/lib/server/store";
import { createSession, signIn } from "@/lib/server/users";

export async function POST(request: Request) {
  return handle(async () => {
    const body = (await readJson(request)) as { ident?: unknown; password?: unknown } | null;
    const ident = typeof body?.ident === "string" ? body.ident.slice(0, 64) : "";
    const password = typeof body?.password === "string" ? body.password.slice(0, 256) : "";
    if (!ident || !password) throw new HttpError(401, "Wrong matriculation/staff number or password.");
    const db = await getDb();
    // Failed attempts are limited per account and per IP (see signIn); over the limit the answer is 429.
    const result = await signIn(db, ident, password, clientIp(request));
    if (!result.ok) throw new HttpError(result.status, result.message);
    const { token, expires } = await createSession(db, result.user.id);
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires,
    });
    return json({ user: sessionUser(result.user) });
  });
}
