import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@/lib/server/db";
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
  const user = db.prepare("SELECT * FROM users WHERE matric = ?").get(matric.trim()) as UserRow | undefined;
  const ok = await verifyPassword(password, user?.password_hash ?? dummyPasswordHash());
  if (!user || !ok) return null;
  return { id: user.id, matric: user.matric, name: user.name, role: user.role };
}

export function createSession(db: Db, userId: number, now = Date.now()): string {
  const token = randomBytes(32).toString("base64url");
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    hashToken(token),
    userId,
    now,
    now + SESSION_TTL_MS,
  );
  return token;
}

export function userForSession(db: Db, token: string | undefined, now = Date.now()): SessionUser | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.matric, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), now) as SessionUser | undefined;
  return row ? { id: row.id, matric: row.matric, name: row.name, role: row.role } : null;
}

export function deleteSession(db: Db, token: string | undefined): void {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
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
