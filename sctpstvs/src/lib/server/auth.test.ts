import { describe, expect, it } from "vitest";
import { checkCredentials, createSession, deleteSession, userForSession, SESSION_TTL_MS } from "@/lib/server/auth";
import { hashPassword, verifyPassword } from "@/lib/server/passwords";
import { rateLimit } from "@/lib/server/rate-limit";
import { RICH, testDb } from "@/lib/server/test-helpers";

describe("passwords", () => {
  it("hash with a random salt and verify", async () => {
    const a = await hashPassword("secret");
    const b = await hashPassword("secret");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("secret", a)).toBe(true);
    expect(await verifyPassword("Secret", a)).toBe(false);
  });
});

describe("sign-in and sessions", () => {
  it("accepts the right password only", async () => {
    const db = testDb();
    expect((await checkCredentials(db, "csc/2021/001", "student123"))?.matric).toBe(RICH);
    expect(await checkCredentials(db, RICH, "wrong")).toBeNull();
    expect(await checkCredentials(db, "NOPE/1", "student123")).toBeNull();
  });

  it("issues sessions that expire and can be revoked", async () => {
    const db = testDb();
    const user = (await checkCredentials(db, RICH, "student123"))!;
    const token = createSession(db, user.id, 1000);
    expect(userForSession(db, token, 2000)?.id).toBe(user.id);
    expect(userForSession(db, token, 1000 + SESSION_TTL_MS)).toBeNull();
    expect(userForSession(db, "made-up", 2000)).toBeNull();
    deleteSession(db, token);
    expect(userForSession(db, token, 2000)).toBeNull();
  });
});

describe("rate limiting", () => {
  it("refuses after the limit, flags only the first refusal, and recovers after the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 1000, 0).ok).toBe(true);
    expect(rateLimit(key, 3, 1000, 10)).toMatchObject({ ok: false, firstRefusal: true });
    expect(rateLimit(key, 3, 1000, 20)).toMatchObject({ ok: false, firstRefusal: false });
    expect(rateLimit(key, 3, 1000, 1500).ok).toBe(true);
  });
});
