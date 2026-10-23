import { AppError } from "@/lib/server/errors";
import { readCookie, SESSION_COOKIE, userForSession } from "@/lib/server/auth";
import { getDb } from "@/lib/server/context";
import type { Role, SessionUser } from "@/lib/types";

export function jsonError(message: string, status: number, headers?: HeadersInit): Response {
  return Response.json({ error: message }, { status, headers });
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
}

/**
 * Rejects cross-site writes. The SameSite=Lax cookie already blocks most of
 * them; this also covers older browsers. Requests without an Origin header
 * (curl, server-to-server) are allowed because they carry no ambient cookie risk.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/** Returns the signed-in user, or a Response to send back if they are not allowed in. */
export function requireUser(request: Request, roles?: Role[]): SessionUser | Response {
  if (request.method !== "GET" && !sameOrigin(request)) return jsonError("Cross-site request refused.", 403);
  const user = userForSession(getDb(), readCookie(request, SESSION_COOKIE));
  if (!user) return jsonError("Please sign in.", 401);
  if (roles && !roles.includes(user.role)) return jsonError("You do not have access to this.", 403);
  return user;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

/** Turns known errors into JSON responses; anything else is a 500 without internals. */
export function handleError(err: unknown): Response {
  if (err instanceof AppError) return jsonError(err.message, err.status);
  console.error(err);
  return jsonError("Something went wrong. Please try again.", 500);
}
