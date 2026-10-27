import { checkCredentials, createSession, sessionCookie } from "@/lib/server/auth";
import { getDb } from "@/lib/server/context";
import { logFraud } from "@/lib/server/fraud";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/server/http";
import { LIMITS, rateLimit, resetRateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Cross-site request refused.", 403);
  const body = await readJson(request);
  const matric = typeof body.matric === "string" ? body.matric.trim().toUpperCase().slice(0, 40) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  if (!matric || !password) return jsonError("Enter your matric or staff number and password.", 400);

  const db = await getDb();
  const ip = clientIp(request);
  const accountKey = `login:acct:${matric}`;
  for (const [key, cfg] of [
    [accountKey, LIMITS.loginAccount],
    [`login:ip:${ip}`, LIMITS.loginIp],
  ] as const) {
    const limit = await rateLimit(db, key, cfg.limit, cfg.windowMs);
    if (!limit.ok) {
      if (limit.firstRefusal) await logFraud(db, { kind: "rate_limit_login", ip, detail: `Too many sign-ins for ${matric}` });
      const minutes = Math.ceil(limit.retryAfterMs / 60_000);
      return jsonError(`Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, 429, {
        "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)),
      });
    }
  }

  const user = await checkCredentials(db, matric, password);
  if (!user) return jsonError("Wrong matric/staff number or password.", 401);
  await resetRateLimit(db, accountKey);
  const token = await createSession(db, user.id);
  return Response.json({ user }, { headers: { "set-cookie": sessionCookie(token) } });
}
