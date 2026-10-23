import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";

// N=2^15 takes ~50 ms here: slow enough to hurt offline guessing, fast enough for a login.
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 32;

function encode(salt: Buffer, key: Buffer): string {
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, KEY_LEN, PARAMS, (err, k) => (err ? reject(err) : resolve(k))),
  );
  return encode(salt, key);
}

/** Synchronous variant, only for seeding demo accounts at start-up. */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  return encode(salt, scryptSync(password, salt, KEY_LEN, PARAMS));
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const params = { N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem };
  const key = await new Promise<Buffer>((resolve, reject) =>
    scrypt(password, Buffer.from(saltB64, "base64"), expected.length, params, (err, k) =>
      err ? reject(err) : resolve(k),
    ),
  );
  return timingSafeEqual(key, expected);
}

// Hashed once so a login for an unknown account costs the same as a real one.
let dummyHash: string | undefined;
export function dummyPasswordHash(): string {
  dummyHash ??= hashPasswordSync("not-a-real-password");
  return dummyHash;
}
