import { createHash, randomBytes } from "node:crypto";
import { type Db, ts } from "@/lib/server/db";
import { dummyPasswordHash, verifyPassword } from "@/lib/server/passwords";
import type { Role, SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "sct_session";
export const SESSION_TTL_MS = 12 * 60 * 60_000;

// Only a hash of the session token is stored, so a leaked database can't be used to log in.
const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

interface UserRow {
  id: number;
  matric: string;
  name: string;
  role: Role;
  password_hash: string;
}

/** Checks credentials; returns the user or null. Takes the same time whether or not the account exists. */
export async function checkCredentials(db: Db, matric: string, password: string): Promise<SessionUser | null> {
  const user = await db.maybeOne<UserRow>("SELECT * FROM {schema}.users WHERE upper(matric) = upper($1)", [matric.trim()]);
  const ok = await verifyPassword(password, user?.password_hash ?? dummyPasswordHash());
  if (!user || !ok) return null;
  return { id: user.id, matric: user.matric, name: user.name, role: user.role };
}

export async function createSession(db: Db, userId: number, now = Date.now()): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query("DELETE FROM {schema}.sessions WHERE expires_at <= $1", [ts(now)]);
  await db.query(
    "INSERT INTO {schema}.sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)",
    [hashToken(token), userId, ts(now), ts(now + SESSION_TTL_MS)],
  );
  return token;
}

export async function userForSession(db: Db, token: string | undefined, now = Date.now()): Promise<SessionUser | null> {
  if (!token) return null;
  const row = await db.maybeOne<SessionUser>(
    `SELECT u.id, u.matric, u.name, u.role FROM {schema}.sessions s JOIN {schema}.users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > $2`,
    [hashToken(token), ts(now)],
  );
  return row ? { id: row.id, matric: row.matric, name: row.name, role: row.role } : null;
}

export async function deleteSession(db: Db, token: string | undefined): Promise<void> {
  if (token) await db.query("DELETE FROM {schema}.sessions WHERE token_hash = $1", [hashToken(token)]);
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function sessionCookie(token: string, maxAgeMs = SESSION_TTL_MS): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
