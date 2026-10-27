import { describe, expect, it } from "vitest";
import { checkCredentials, createSession, deleteSession, userForSession, SESSION_TTL_MS } from "@/lib/server/auth";
import { hashPassword, verifyPassword } from "@/lib/server/passwords";
import { rateLimit, resetRateLimit } from "@/lib/server/rate-limit";
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
    const db = await testDb();
    expect((await checkCredentials(db, "csc/2021/001", "student123"))?.matric).toBe(RICH);
    expect(await checkCredentials(db, RICH, "wrong")).toBeNull();
    expect(await checkCredentials(db, "NOPE/1", "student123")).toBeNull();
  });

  it("issues sessions that expire and can be revoked, storing only a hash", async () => {
    const db = await testDb();
    const user = (await checkCredentials(db, RICH, "student123"))!;
    const token = await createSession(db, user.id, 1000);
    expect((await userForSession(db, token, 2000))?.id).toBe(user.id);
    expect(await userForSession(db, token, 1000 + SESSION_TTL_MS)).toBeNull();
    expect(await userForSession(db, "made-up", 2000)).toBeNull();
    const stored = await db.query<{ token_hash: string }>("SELECT token_hash FROM {schema}.sessions");
    expect(stored.map((s) => s.token_hash)).not.toContain(token);
    await deleteSession(db, token);
    expect(await userForSession(db, token, 2000)).toBeNull();
  });
});

describe("rate limiting", () => {
  it("refuses after the limit, flags only the first refusal, and recovers after the window", async () => {
    const db = await testDb();
    const key = "test-key";
    for (let i = 0; i < 3; i++) expect((await rateLimit(db, key, 3, 1000, 0)).ok).toBe(true);
    expect(await rateLimit(db, key, 3, 1000, 10)).toMatchObject({ ok: false, firstRefusal: true, retryAfterMs: 990 });
    expect(await rateLimit(db, key, 3, 1000, 20)).toMatchObject({ ok: false, firstRefusal: false });
    expect((await rateLimit(db, key, 3, 1000, 1500)).ok).toBe(true);
  });

  it("is shared state in the database, counts concurrent requests exactly, and can be reset", async () => {
    const db = await testDb();
    const results = await Promise.all(Array.from({ length: 8 }, () => rateLimit(db, "burst", 5, 60_000, 100)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => r.firstRefusal)).toHaveLength(1);
    await resetRateLimit(db, "burst");
    expect((await rateLimit(db, "burst", 5, 60_000, 200)).ok).toBe(true);
  });
});
