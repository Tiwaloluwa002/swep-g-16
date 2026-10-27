import { cookies } from "next/headers";
import QRCode from "qrcode";
import type { Role, User } from "@/lib/types";
import { ClaimError } from "./claims";
import { assertNoLeaks } from "./serialize";
import { getDb } from "./store";
import { getSessionUser } from "./users";

export const SESSION_COOKIE = "ppcl_session";

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function currentUser(): Promise<User | null> {
  return getSessionUser(await getDb(), await sessionToken());
}

/**
 * The caller's IP for the sign-in rate limit. Behind Vercel or a reverse
 * proxy this is the first x-forwarded-for entry; elsewhere the header can be
 * forged, which only weakens the per-IP limit (the per-account limit stays).
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || request.headers.get("x-real-ip")?.trim() || "unknown").slice(0, 64);
}

/** Thrown by route code; turned into a JSON error by `handle`. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(...roles: Role[]): Promise<User> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in first.");
  if (roles.length > 0 && !roles.includes(user.role)) throw new HttpError(403, "You do not have access to this.");
  return user;
}

/**
 * Mutating requests must be JSON. Browsers cannot send a cross-site JSON
 * body without a CORS preflight, so together with the SameSite cookie
 * this blocks cross-site request forgery.
 */
export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new HttpError(415, "Send the request as JSON.");
  }
  return request.json().catch(() => {
    throw new HttpError(400, "Invalid JSON.");
  });
}

/** Every response goes through the leak guard. */
export function json(data: unknown, status = 200, options: { allowPrivateDetails?: boolean } = {}): Response {
  assertNoLeaks(data, options);
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function errorJson(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError || err instanceof ClaimError) return errorJson(err.message, err.status);
    console.error(err);
    return errorJson("Something went wrong.", 500);
  }
}

export function qrDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code, { margin: 1, width: 240, errorCorrectionLevel: "M" });
}
