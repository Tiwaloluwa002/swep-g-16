import { randomUUID } from "node:crypto";
import type { Role, User } from "@/lib/types";
import { hashPassword, newToken, sha256, verifyPassword } from "./crypto";
import { type Db, one, type Row, run } from "./db";

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
    createdAt: String(row.created_at),
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

export function createUser(db: Db, input: NewUser, now = new Date()): User {
  const id = randomUUID();
  run(
    db,
    `INSERT INTO users (id, ident, name, role, desk_id, phone, email, password_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  return getUser(db, id)!;
}

export function getUser(db: Db, id: string): User | undefined {
  const row = one(db, "SELECT * FROM users WHERE id = ?", id);
  return row && toUser(row);
}

// Compared against when the ident is unknown, so a wrong ident takes as long as a wrong password.
const DUMMY_HASH = hashPassword("not-a-real-password");

export function authenticate(db: Db, ident: string, password: string): User | null {
  const row = one(db, "SELECT * FROM users WHERE ident = ?", normalizeIdent(ident));
  if (!row) {
    verifyPassword(password, DUMMY_HASH);
    return null;
  }
  const user = toUser(row);
  return verifyPassword(password, user.passwordHash) ? user : null;
}

/** Returns the raw token for the cookie; only its hash is stored. */
export function createSession(db: Db, userId: string, now = new Date()): { token: string; expires: Date } {
  const token = newToken();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  run(db, "DELETE FROM sessions WHERE expires_at < ?", now.toISOString());
  run(db, "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", sha256(token), userId, expires.toISOString());
  return { token, expires };
}

export function getSessionUser(db: Db, token: string | undefined, now = new Date()): User | null {
  if (!token) return null;
  const row = one(
    db,
    `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    sha256(token),
    now.toISOString(),
  );
  return row ? toUser(row) : null;
}

export function deleteSession(db: Db, token: string): void {
  run(db, "DELETE FROM sessions WHERE token_hash = ?", sha256(token));
}
