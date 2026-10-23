import { randomBytes, randomInt, sign, verify } from "node:crypto";
import type { SigningKeys } from "@/lib/server/keys";

/*
 * Ticket token: "SCT1.<payload>.<signature>", both parts base64url.
 * The payload is JSON with the ticket id, route id, issue and expiry times
 * (Unix seconds) and the signing key id. The Ed25519 signature covers
 * "SCT1.<payload>", so neither the version nor any claim can be altered.
 */
export const TOKEN_PREFIX = "SCT1";
const MAX_TOKEN_LENGTH = 512;
const B64URL = /^[A-Za-z0-9_-]+$/;

export interface TicketClaims {
  tid: string;
  rid: number;
  iat: number;
  exp: number;
  kid: string;
}

export function newTicketId(): string {
  return randomBytes(12).toString("base64url");
}

export function signTicket(claims: TicketClaims, keys: SigningKeys): string {
  const signed = `${TOKEN_PREFIX}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}`;
  const signature = sign(null, Buffer.from(signed), keys.privateKey).toString("base64url");
  return `${signed}.${signature}`;
}

export type TokenCheck =
  | { ok: true; claims: TicketClaims }
  | { ok: false; reason: "bad_format" | "bad_signature" };

/** Checks shape and signature only. Expiry and single use are checked against the database. */
export function verifyTicketToken(token: string, keys: SigningKeys): TokenCheck {
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "bad_format" };
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX || !B64URL.test(parts[1]) || !B64URL.test(parts[2])) {
    return { ok: false, reason: "bad_format" };
  }
  const signature = Buffer.from(parts[2], "base64url");
  if (signature.length !== 64) return { ok: false, reason: "bad_signature" };
  if (!verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), keys.publicKey, signature)) {
    return { ok: false, reason: "bad_signature" };
  }
  // Only parse what the signature vouches for.
  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "bad_format" };
  }
  if (!isClaims(claims) || claims.kid !== keys.keyId) return { ok: false, reason: "bad_signature" };
  return { ok: true, claims };
}

function isClaims(value: unknown): value is TicketClaims {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.tid === "string" &&
    Number.isInteger(c.rid) &&
    Number.isInteger(c.iat) &&
    Number.isInteger(c.exp) &&
    typeof c.kid === "string"
  );
}

export function looksLikeToken(input: string): boolean {
  return input.startsWith(`${TOKEN_PREFIX}.`);
}

/*
 * Backup code for manual entry: 10 random Crockford base32 characters
 * (50 bits), shown as XXXXX-XXXXX. It is a lookup key, not a signature, so
 * it relies on being unguessable plus the rate limit on verification.
 */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const SHORT_CODE_LENGTH = 10;

export function newShortCode(): string {
  let code = "";
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) code += CROCKFORD[randomInt(CROCKFORD.length)];
  return code;
}

export function formatShortCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/** Normalises what a conductor typed: case, spaces, dashes and look-alike letters. */
export function normaliseShortCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  if (code.length !== SHORT_CODE_LENGTH) return null;
  for (const ch of code) if (!CROCKFORD.includes(ch)) return null;
  return code;
}
