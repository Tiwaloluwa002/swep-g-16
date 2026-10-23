import { describe, expect, it } from "vitest";
import { answerMatches, hashAnswer, hashPassword, newHandoverCode, normalizeHandoverCode, verifyPassword } from "./crypto";
import { checkAttempt, MAX_ATTEMPTS_PER_CLAIM, MAX_ATTEMPTS_PER_DAY } from "./limits";
import { openDatabase } from "./db";
import { authenticate, createSession, createUser, getSessionUser } from "./users";

describe("answer hashing", () => {
  it("matches after normalisation and differs per salt", () => {
    const hash = hashAnswer("Blue Star", "salt-a");
    expect(answerMatches("  blue   star", "salt-a", hash)).toBe(true);
    expect(answerMatches("blue stars", "salt-a", hash)).toBe(false);
    expect(hashAnswer("Blue Star", "salt-b")).not.toBe(hash);
  });
});

describe("passwords and sessions", () => {
  it("verifies scrypt hashes", () => {
    const stored = hashPassword("secret");
    expect(stored).not.toContain("secret");
    expect(verifyPassword("secret", stored)).toBe(true);
    expect(verifyPassword("Secret", stored)).toBe(false);
  });

  it("signs in by matric number, ignoring case and spaces", () => {
    const db = openDatabase(":memory:");
    createUser(db, { ident: "CSC/2021/045", name: "A", role: "member", password: "pw" });
    expect(authenticate(db, " csc/2021/045 ", "pw")?.name).toBe("A");
    expect(authenticate(db, "CSC/2021/045", "nope")).toBeNull();
    expect(authenticate(db, "unknown", "pw")).toBeNull();
  });

  it("expires sessions", () => {
    const db = openDatabase(":memory:");
    const user = createUser(db, { ident: "X/1", name: "A", role: "member", password: "pw" });
    const now = new Date("2026-10-22T00:00:00Z");
    const { token } = createSession(db, user.id, now);
    expect(getSessionUser(db, token, now)?.id).toBe(user.id);
    expect(getSessionUser(db, token, new Date("2026-11-30T00:00:00Z"))).toBeNull();
    expect(getSessionUser(db, "forged", now)).toBeNull();
  });
});

describe("handover code format", () => {
  it("is 8 unambiguous characters and normalises user input", () => {
    const code = newHandoverCode();
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    expect(normalizeHandoverCode(code.toLowerCase().replace("-", " "))).toBe(code);
  });
});

describe("checkAttempt", () => {
  it("enforces per-claim and per-day limits", () => {
    expect(checkAttempt(0, 0).ok).toBe(true);
    expect(checkAttempt(MAX_ATTEMPTS_PER_CLAIM, 0)).toMatchObject({ ok: false, reason: "claim-locked" });
    expect(checkAttempt(0, MAX_ATTEMPTS_PER_DAY)).toMatchObject({ ok: false, reason: "daily-limit" });
  });
});
