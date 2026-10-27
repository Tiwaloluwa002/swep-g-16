import { randomUUID } from "node:crypto";
import type { Role, User } from "@/lib/types";
import { hashPassword, newToken, sha256, verifyPassword } from "./crypto";
import { count, type Db, iso, one, type Row, run } from "./db";
import { LOGIN_LIMIT_MESSAGE, LOGIN_WINDOW_MS, MAX_LOGIN_FAILURES_PER_ACCOUNT, MAX_LOGIN_FAILURES_PER_IP } from "./limits";

const SESSION_DAYS = 7;

function toUser(row: Row): User {
  return {
    id: String(row.id),
    ident: String(row.ident),
    name: String(row.name),
    role: row.role as Role,
    deskId: (row.desk_id as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    passwordHash: String(row.password_hash),
    createdAt: iso(row.created_at),
  };
}

/** Matric and staff numbers are matched case-insensitively and without spaces. */
export function normalizeIdent(ident: string): string {
  return ident.trim().toUpperCase().replace(/\s+/g, "");
}

export type NewUser = {
  ident: string;
  name: string;
  role: Role;
  password: string;
  deskId?: string | null;
  phone?: string | null;
  email?: string | null;
};

export async function createUser(db: Db, input: NewUser, now = new Date()): Promise<User> {
  const id = randomUUID();
  await run(
    db,
    `INSERT INTO {schema}.users (id, ident, name, role, desk_id, phone, email, password_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    id,
    normalizeIdent(input.ident),
    input.name,
    input.role,
    input.deskId ?? null,
    input.phone ?? null,
    input.email ?? null,
    hashPassword(input.password),
    now.toISOString(),
  );
  return (await getUser(db, id))!;
}

export async function getUser(db: Db, id: string): Promise<User | undefined> {
  const row = await one(db, "SELECT * FROM {schema}.users WHERE id = $1", id);
  return row && toUser(row);
}

// Compared against when the ident is unknown, so a wrong ident takes as long as a wrong password.
const DUMMY_HASH = hashPassword("not-a-real-password");

export async function authenticate(db: Db, ident: string, password: string): Promise<User | null> {
  const row = await one(db, "SELECT * FROM {schema}.users WHERE ident = $1", normalizeIdent(ident));
  if (!row) {
    verifyPassword(password, DUMMY_HASH);
    return null;
  }
  const user = toUser(row);
  return verifyPassword(password, user.passwordHash) ? user : null;
}

export type SignInResult = { ok: true; user: User } | { ok: false; status: 401 | 429; message: string };

/**
 * Sign-in with a rate limit kept in the database (so it holds across server
 * instances): at most 5 failures per account and 30 per IP address in any
 * 15 minutes. Unknown accounts count too, so the limit says nothing about
 * which matric numbers exist.
 *
 * The check and the record happen in one short transaction that holds
 * advisory locks on the account and the IP, so parallel guesses take turns:
 * each one counts the earlier ones and reserves its own slot (as a failure)
 * before the slow password hash runs outside the lock. No more than the
 * limit can get through, however many arrive at once. A successful sign-in
 * removes its row and resets the account's counter.
 */
export async function signIn(db: Db, ident: string, password: string, ip: string, now = new Date()): Promise<SignInResult> {
  const key = normalizeIdent(ident);
  const since = new Date(now.getTime() - LOGIN_WINDOW_MS).toISOString();
  const id = randomUUID();

  const allowed = await db.transaction(async (tx) => {
    // Always account first, then IP, so two requests never wait on each other in a cycle.
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${tx.schema}:login:${key}`]);
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${tx.schema}:login-ip:${ip}`]);
    const forAccount = await count(tx, "SELECT COUNT(*)::int AS n FROM {schema}.login_failures WHERE ident = $1 AND created_at > $2", key, since);
    const forIp = await count(tx, "SELECT COUNT(*)::int AS n FROM {schema}.login_failures WHERE ip = $1 AND created_at > $2", ip, since);
    if (forAccount >= MAX_LOGIN_FAILURES_PER_ACCOUNT || forIp >= MAX_LOGIN_FAILURES_PER_IP) return false;
    await run(tx, "INSERT INTO {schema}.login_failures (id, ident, ip, created_at) VALUES ($1, $2, $3, $4)", id, key, ip, now.toISOString());
    return true;
  });
  // A refused attempt is not a guess, so it is not recorded and does not extend the lockout.
  if (!allowed) return { ok: false, status: 429, message: LOGIN_LIMIT_MESSAGE };
  await run(db, "DELETE FROM {schema}.login_failures WHERE created_at <= $1", since);

  const user = await authenticate(db, key, password);
  if (!user) return { ok: false, status: 401, message: "Wrong matriculation/staff number or password." };
  await run(db, "DELETE FROM {schema}.login_failures WHERE id = $1 OR ident = $2", id, key);
  return { ok: true, user };
}

/** Returns the raw token for the cookie; only its hash is stored. */
export async function createSession(db: Db, userId: string, now = new Date()): Promise<{ token: string; expires: Date }> {
  const token = newToken();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await run(db, "DELETE FROM {schema}.sessions WHERE expires_at < $1", now.toISOString());
  await run(db, "INSERT INTO {schema}.sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", sha256(token), userId, expires.toISOString());
  return { token, expires };
}

export async function getSessionUser(db: Db, token: string | undefined, now = new Date()): Promise<User | null> {
  if (!token) return null;
  const row = await one(
    db,
    `SELECT u.* FROM {schema}.sessions s JOIN {schema}.users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > $2`,
    sha256(token),
    now.toISOString(),
  );
  return row ? toUser(row) : null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await run(db, "DELETE FROM {schema}.sessions WHERE token_hash = $1", sha256(token));
}
