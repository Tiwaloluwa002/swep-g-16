import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/lib/server/db";
import { listFraud } from "@/lib/server/fraud";
import { CONDUCTOR, POOR, RICH, routeId, testDb, testKeys, userId } from "@/lib/server/test-helpers";
import { listOwnTickets, purchaseTicket, refundTicket, verifyAndRedeem } from "@/lib/server/tickets";
import { signTicket } from "@/lib/server/tokens";
import { getBalance } from "@/lib/server/wallet";

const NOW = Date.UTC(2026, 9, 23, 9, 0); // 10:00 in Lagos
const HOUR = 60 * 60_000;

function setup() {
  const db = testDb();
  return {
    db,
    student: userId(db, RICH),
    conductor: userId(db, CONDUCTOR),
    route: routeId(db, "Main Gate – SUB"), // ₦200
    otherRoute: routeId(db, "Moremi Hall – Senate"),
  };
}

describe("buying a ticket", () => {
  it("charges the fare stored on the route and records it in the ledger", () => {
    const { db, student, route } = setup();
    const ticket = purchaseTicket(db, testKeys, student, route, { now: NOW });
    expect(ticket.fareKobo).toBe(200_00);
    expect(getBalance(db, student)).toBe(1800_00);
    expect(ticket.status).toBe("active");
    expect(ticket.expiresAt).toBe(NOW + 2 * HOUR);
    expect(ticket.token.startsWith("SCT1.")).toBe(true);
  });

  it("uses the current fare even if an admin changes it, never a client value", () => {
    const { db, student, route } = setup();
    db.prepare("UPDATE routes SET fare_kobo = 350_00 WHERE id = ?").run(route);
    purchaseTicket(db, testKeys, student, route, { now: NOW });
    expect(getBalance(db, student)).toBe(1650_00);
  });

  it("refuses when the balance is below the fare and leaves the wallet untouched", () => {
    const { db, route } = setup();
    const poor = userId(db, POOR);
    expect(() => purchaseTicket(db, testKeys, poor, route, { now: NOW })).toThrow(/Insufficient funds/);
    expect(getBalance(db, poor)).toBe(100_00);
    expect(listOwnTickets(db, poor)).toHaveLength(0);
  });

  it("refuses inactive or unknown routes", () => {
    const { db, student, route } = setup();
    db.prepare("UPDATE routes SET active = 0 WHERE id = ?").run(route);
    expect(() => purchaseTicket(db, testKeys, student, route)).toThrow(/not available/);
    expect(() => purchaseTicket(db, testKeys, student, 9999)).toThrow(/not available/);
  });

  it("never lets simultaneous purchases overspend the wallet", async () => {
    const { db, route } = setup();
    const poor = userId(db, POOR);
    db.prepare("INSERT INTO ledger (user_id, kind, amount_kobo, created_at) VALUES (?, 'topup', 150_00, ?)").run(poor, NOW);
    // ₦250 buys exactly one ₦200 ticket, however many requests arrive at once.
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => Promise.resolve().then(() => purchaseTicket(db, testKeys, poor, route))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(getBalance(db, poor)).toBe(50_00);
  });
});

describe("the wallet ledger", () => {
  it("cannot go negative even with a direct insert", () => {
    const { db, student } = setup();
    expect(() =>
      db
        .prepare("INSERT INTO ledger (user_id, kind, amount_kobo, created_at) VALUES (?, 'purchase', ?, ?)")
        .run(student, -2001_00, NOW),
    ).toThrow(/insufficient funds/);
    expect(getBalance(db, student)).toBe(2000_00);
  });

  it("is append-only", () => {
    const { db } = setup();
    expect(() => db.exec("UPDATE ledger SET amount_kobo = 999999")).toThrow(/append-only/);
    expect(() => db.exec("DELETE FROM ledger")).toThrow(/append-only/);
  });

  it("rejects purchases recorded as credits", () => {
    const { db, student } = setup();
    expect(() =>
      db.prepare("INSERT INTO ledger (user_id, kind, amount_kobo, created_at) VALUES (?, 'purchase', 500, ?)").run(student, NOW),
    ).toThrow();
  });
});

describe("verifying a ticket", () => {
  it("accepts a fresh ticket once, then reports ALREADY USED with time and vehicle", () => {
    const { db, student, conductor, route } = setup();
    const ticket = purchaseTicket(db, testKeys, student, route, { now: NOW });
    const vehicle = { name: "Bus 3", routeId: route, routeName: "Main Gate – SUB" };

    const first = verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, vehicle, now: NOW + 42 * 60_000 });
    expect(first.outcome).toBe("valid");

    const second = verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, now: NOW + HOUR });
    expect(second.outcome).toBe("already_used");
    expect(second.headline).toBe("ALREADY USED at 10:42 on Bus 3");
    expect(listFraud(db).map((f) => f.kind)).toEqual(["reuse"]);
  });

  it("also accepts the backup code, typed loosely, and it is single-use too", () => {
    const { db, student, conductor, route } = setup();
    const ticket = purchaseTicket(db, testKeys, student, route, { now: NOW });
    const typed = ticket.shortCode.toLowerCase().replace("-", " ");
    expect(verifyAndRedeem(db, testKeys, typed, { conductorId: conductor, now: NOW }).outcome).toBe("valid");
    expect(verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, now: NOW }).outcome).toBe("already_used");
  });

  it("reports EXPIRED after the expiry time and does not use the ticket", () => {
    const { db, student, conductor, route } = setup();
    const ticket = purchaseTicket(db, testKeys, student, route, { now: NOW, ttlMs: HOUR });
    const late = verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, now: NOW + HOUR });
    expect(late.outcome).toBe("expired");
    expect(late.headline).toBe("EXPIRED");
    expect(listOwnTickets(db, student, NOW + HOUR)[0].status).toBe("expired");
  });

  it("reports INVALID for tampered, forged and unknown codes, and logs them", () => {
    const { db, student, conductor, route } = setup();
    const ticket = purchaseTicket(db, testKeys, student, route, { now: NOW });
    const [prefix, payload, sig] = ticket.token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    const longer = Buffer.from(JSON.stringify({ ...claims, exp: claims.exp + 86400 })).toString("base64url");
    const ctx = { conductorId: conductor, now: NOW };

    expect(verifyAndRedeem(db, testKeys, `${prefix}.${longer}.${sig}`, ctx).headline).toBe("INVALID");
    expect(verifyAndRedeem(db, testKeys, "not a ticket!", ctx).outcome).toBe("invalid");
    expect(verifyAndRedeem(db, testKeys, "ZZZZZ-ZZZZZ", ctx).outcome).toBe("invalid");
    // Correctly signed, but for a ticket that was never sold.
    const ghost = signTicket({ ...claims, tid: "never-sold" }, testKeys);
    expect(verifyAndRedeem(db, testKeys, ghost, ctx).outcome).toBe("invalid");

    expect(listFraud(db).map((f) => f.kind).sort()).toEqual(["bad_format", "bad_signature", "bad_signature", "unknown_code"]);
    // The real ticket is still usable after all that.
    expect(verifyAndRedeem(db, testKeys, ticket.token, ctx).outcome).toBe("valid");
  });

  it("reports WRONG ROUTE on a vehicle serving another route and leaves the ticket unused", () => {
    const { db, student, conductor, route, otherRoute } = setup();
    const ticket = purchaseTicket(db, testKeys, student, route, { now: NOW });
    const bus4 = { name: "Bus 4", routeId: otherRoute, routeName: "Moremi Hall – Senate" };
    expect(verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, vehicle: bus4, now: NOW }).outcome).toBe(
      "wrong_route",
    );
    const anyRoute = { name: "Shuttle 5", routeId: null, routeName: null };
    expect(verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, vehicle: anyRoute, now: NOW }).outcome).toBe(
      "valid",
    );
  });

  it("lets exactly one of many simultaneous scans succeed", async () => {
    const { db, student, conductor, route } = setup();
    const ticket = purchaseTicket(db, testKeys, student, route, { now: NOW });
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        Promise.resolve().then(() => verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, now: NOW })),
      ),
    );
    expect(results.filter((r) => r.outcome === "valid")).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "already_used")).toHaveLength(19);
  });
});

describe("redemption across separate database connections", () => {
  let dir: string | undefined;
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it("lets only one connection redeem even if both saw the ticket unused", () => {
    dir = mkdtempSync(path.join(tmpdir(), "sct-"));
    const file = path.join(dir, "test.db");
    const a = openDatabase(file);
    const b = openDatabase(file); // like a second server process
    const student = userId(a, RICH);
    const conductor = userId(a, CONDUCTOR);
    const ticket = purchaseTicket(a, testKeys, student, routeId(a, "Main Gate – SUB"), { now: NOW });

    // Both connections read the ticket as unused...
    const read = "SELECT status FROM tickets WHERE id = ?";
    expect((a.prepare(read).get(ticket.id) as { status: string }).status).toBe("active");
    expect((b.prepare(read).get(ticket.id) as { status: string }).status).toBe("active");

    // ...but the guarded UPDATE lets only the first writer through.
    const first = verifyAndRedeem(b, testKeys, ticket.token, { conductorId: conductor, now: NOW });
    const second = verifyAndRedeem(a, testKeys, ticket.token, { conductorId: conductor, now: NOW });
    expect([first.outcome, second.outcome]).toEqual(["valid", "already_used"]);
    a.close();
    b.close();
  });
});

describe("refunds", () => {
  it("returns the fare for an unused ticket, once, and the ticket stops working", () => {
    const { db, student, conductor, route } = setup();
    const admin = userId(db, "ADM/001");
    const ticket = purchaseTicket(db, testKeys, student, route, { now: NOW });
    expect(refundTicket(db, ticket.id, admin, NOW).status).toBe("refunded");
    expect(getBalance(db, student)).toBe(2000_00);
    expect(() => refundTicket(db, ticket.id, admin, NOW)).toThrow(/unused/);
    expect(verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, now: NOW }).outcome).toBe("invalid");
  });

  it("refuses to refund a used ticket", () => {
    const { db, student, conductor, route } = setup();
    const ticket = purchaseTicket(db, testKeys, student, route, { now: NOW });
    verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, now: NOW });
    expect(() => refundTicket(db, ticket.id, userId(db, "ADM/001"), NOW)).toThrow(/unused/);
  });
});
