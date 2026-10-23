import { cookies } from "next/headers";
import { handle, HttpError, json, readJson, SESSION_COOKIE } from "@/lib/server/http";
import { sessionUser } from "@/lib/server/serialize";
import { getDb } from "@/lib/server/store";
import { authenticate, createSession } from "@/lib/server/users";

export async function POST(request: Request) {
  return handle(async () => {
    const body = (await readJson(request)) as { ident?: unknown; password?: unknown } | null;
    const ident = typeof body?.ident === "string" ? body.ident : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const db = getDb();
    const user = ident && password ? authenticate(db, ident, password) : null;
    if (!user) throw new HttpError(401, "Wrong matriculation/staff number or password.");
    const { token, expires } = createSession(db, user.id);
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires,
    });
    return json({ user: sessionUser(user) });
  });
}
