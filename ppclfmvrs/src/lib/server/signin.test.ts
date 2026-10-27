import { describe, expect, it } from "vitest";
import { count, type Db } from "./db";
import { LOGIN_WINDOW_MS, MAX_LOGIN_FAILURES_PER_ACCOUNT, MAX_LOGIN_FAILURES_PER_IP } from "./limits";
import { freshDb, NOW } from "./test-helpers";
import { createUser, signIn } from "./users";

const at = (ms: number) => new Date(NOW.getTime() + ms);
const IP = "203.0.113.7";

async function setup(): Promise<Db> {
  const db = await freshDb();
  await createUser(db, { ident: "CSC/2021/045", name: "Tolu", role: "member", password: "right-pass" }, NOW);
  await createUser(db, { ident: "EEG/2020/118", name: "Chinedu", role: "member", password: "other-pass" }, NOW);
  return db;
}

async function failTimes(db: Db, n: number, ident = "CSC/2021/045", ip = IP, now = NOW) {
  for (let i = 0; i < n; i++) expect((await signIn(db, ident, "wrong", ip, now)).ok).toBe(false);
}

describe("sign-in rate limit", () => {
  it("locks an account after 5 failures, even for the right password, until the window passes", async () => {
    const db = await setup();
    await failTimes(db, MAX_LOGIN_FAILURES_PER_ACCOUNT);
    const blocked = await signIn(db, "csc/2021/045", "right-pass", "198.51.100.1", at(60_000));
    expect(blocked).toMatchObject({ ok: false, status: 429 });
    // Refused attempts don't extend the lockout; 15 minutes after the failures it opens again.
    expect((await signIn(db, "CSC/2021/045", "right-pass", IP, at(LOGIN_WINDOW_MS + 1))).ok).toBe(true);
  });

  it("answers 401 for the first 5 failures and 429 after", async () => {
    const db = await setup();
    const statuses = [];
    for (let i = 0; i < 7; i++) {
      const r = await signIn(db, "CSC/2021/045", "wrong", IP, NOW);
      statuses.push(r.ok ? 200 : r.status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429]);
  });

  it("does not lock other accounts", async () => {
    const db = await setup();
    await failTimes(db, MAX_LOGIN_FAILURES_PER_ACCOUNT);
    expect((await signIn(db, "EEG/2020/118", "other-pass", IP, NOW)).ok).toBe(true);
  });

  it("resets the account counter after a successful sign-in", async () => {
    const db = await setup();
    await failTimes(db, MAX_LOGIN_FAILURES_PER_ACCOUNT - 1);
    expect((await signIn(db, "CSC/2021/045", "right-pass", IP, NOW)).ok).toBe(true);
    await failTimes(db, MAX_LOGIN_FAILURES_PER_ACCOUNT - 1);
    expect((await signIn(db, "CSC/2021/045", "right-pass", IP, NOW)).ok).toBe(true);
  });

  it("limits one IP to 30 failures across accounts, including unknown ones", async () => {
    const db = await setup();
    for (let i = 0; i < MAX_LOGIN_FAILURES_PER_IP; i++) {
      expect(await signIn(db, `NOPE/${i}`, "guess", IP, NOW)).toMatchObject({ ok: false, status: 401 });
    }
    expect(await signIn(db, "EEG/2020/118", "other-pass", IP, NOW)).toMatchObject({ ok: false, status: 429 });
    expect((await signIn(db, "EEG/2020/118", "other-pass", "198.51.100.1", NOW)).ok).toBe(true);
  });

  it("lets no more than 5 parallel guesses through", async () => {
    const db = await setup();
    const results = await Promise.all(Array.from({ length: 12 }, () => signIn(db, "CSC/2021/045", "wrong", IP, NOW)));
    expect(results.filter((r) => !r.ok && r.status === 401)).toHaveLength(MAX_LOGIN_FAILURES_PER_ACCOUNT);
    expect(results.filter((r) => !r.ok && r.status === 429)).toHaveLength(12 - MAX_LOGIN_FAILURES_PER_ACCOUNT);
    expect(await count(db, "SELECT COUNT(*)::int AS n FROM {schema}.login_failures")).toBe(MAX_LOGIN_FAILURES_PER_ACCOUNT);
  });
});
