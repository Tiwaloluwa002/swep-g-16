import { createHash, randomBytes, randomInt, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { normalizeAnswer } from "@/lib/text";

const KEY_LENGTH = 32;

function scryptHex(secret: string, salt: string): string {
  return scryptSync(secret, salt, KEY_LENGTH).toString("hex");
}

function equalHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

export function newSalt(): string {
  return randomBytes(16).toString("hex");
}

/** Stored as "scrypt$salt$hash" so the format can change later. */
export function hashPassword(password: string): string {
  const salt = newSalt();
  return `scrypt$${salt}$${scryptHex(password, salt)}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  return equalHex(scryptHex(password, salt), hash);
}

/*
 * Answers are short and guessable, so they get a slow salted hash (scrypt)
 * rather than a plain SHA-256: a leaked database can't be reversed with a
 * quick dictionary run.
 */
export function hashAnswer(answer: string, salt: string): string {
  return scryptHex(normalizeAnswer(answer), salt);
}

const scryptAsync = promisify(scrypt) as (secret: string, salt: string, length: number) => Promise<Buffer>;

/** Async, so checking a claim's answers runs on the thread pool instead of blocking other requests. */
export async function answerMatches(answer: string, salt: string, storedHash: string): Promise<boolean> {
  const hash = (await scryptAsync(normalizeAnswer(answer), salt, KEY_LENGTH)).toString("hex");
  return equalHex(hash, storedHash);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

// No 0/O, 1/I/L: the code is read aloud and typed at a desk.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** An 8-character handover code shown as "ABCD-2345" (about 40 bits). */
export function newHandoverCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Accepts "abcd 2345", "ABCD2345" or "ABCD-2345". */
export function normalizeHandoverCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}
