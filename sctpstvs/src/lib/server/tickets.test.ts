import { describe, expect, it } from "vitest";
import { listFraud } from "@/lib/server/fraud";
import { CONDUCTOR, POOR, RICH, routeId, secondConnection, testDb, testKeys, userId, warmPool } from "@/lib/server/test-helpers";
import { listOwnTickets, purchaseTicket, refundTicket, verifyAndRedeem } from "@/lib/server/tickets";
import { signTicket } from "@/lib/server/tokens";
import { getBalance } from "@/lib/server/wallet";

const NOW = Date.UTC(2026, 9, 23, 9, 0); // 10:00 in Lagos
const HOUR = 60 * 60_000;

async function setup() {
  const db = await testDb();
  return {
    db,
    student: await userId(db, RICH),
    conductor: await userId(db, CONDUCTOR),
    route: await routeId(db, "Main Gate – SUB"), // ₦200
    otherRoute: await routeId(db, "Moremi Hall – Senate"),
  };
}

describe("buying a ticket", () => {
  it("charges the fare stored on the route and records it in the ledger", async () => {
    const { db, student, route } = await setup();
    const ticket = await purchaseTicket(db, testKeys, student, route, { now: NOW });
    expect(ticket.fareKobo).toBe(200_00);
    expect(await getBalance(db, student)).toBe(1800_00);
    expect(ticket.status).toBe("active");
    expect(ticket.expiresAt).toBe(NOW + 2 * HOUR);
    expect(ticket.token.startsWith("SCT1.")).toBe(true);
  });

  it("uses the current fare even if an admin changes it, never a client value", async () => {
    const { db, student, route } = await setup();
    await db.query("UPDATE {schema}.routes SET fare_kobo = 35000 WHERE id = $1", [route]);
    await purchaseTicket(db, testKeys, student, route, { now: NOW });
    expect(await getBalance(db, student)).toBe(1650_00);
  });

  it("refuses when the balance is below the fare and leaves the wallet untouched", async () => {
    const { db, route } = await setup();
    const poor = await userId(db, POOR);
    await expect(purchaseTicket(db, testKeys, poor, route, { now: NOW })).rejects.toThrow(/Insufficient funds/);
    expect(await getBalance(db, poor)).toBe(100_00);
    expect(await listOwnTickets(db, poor)).toHaveLength(0);
  });

  it("refuses inactive or unknown routes", async () => {
    const { db, student, route } = await setup();
    await db.query("UPDATE {schema}.routes SET active = false WHERE id = $1", [route]);
    await expect(purchaseTicket(db, testKeys, student, route)).rejects.toThrow(/not available/);
    await expect(purchaseTicket(db, testKeys, student, 9999)).rejects.toThrow(/not available/);
  });

  it("never lets simultaneous purchases overspend the wallet", async () => {
    const { db, route } = await setup();
    const poor = await userId(db, POOR);
    await db.query("INSERT INTO {schema}.ledger (user_id, kind, amount_kobo, created_at) VALUES ($1, 'topup', 15000, now())", [
      poor,
    ]);
    // ₦250 buys exactly one ₦200 ticket, however many requests arrive at once.
    await warmPool(db);
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => purchaseTicket(db, testKeys, poor, route)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await getBalance(db, poor)).toBe(50_00);
  });
});

describe("the wallet ledger", () => {
  it("cannot go negative even with a direct insert", async () => {
    const { db, student } = await setup();
    await expect(
      db.query("INSERT INTO {schema}.ledger (user_id, kind, amount_kobo, created_at) VALUES ($1, 'purchase', $2, now())", [
        student,
        -2001_00,
      ]),
    ).rejects.toThrow(/insufficient funds/);
    expect(await getBalance(db, student)).toBe(2000_00);
  });

  it("cannot go negative even with many concurrent direct inserts", async () => {
    const { db, student } = await setup();
    // ₦2,000 covers four ₦500 debits; the trigger locks the wallet, so a fifth can never sneak in.
    const debit = () =>
      db.query("INSERT INTO {schema}.ledger (user_id, kind, amount_kobo, created_at) VALUES ($1, 'purchase', -50000, now())", [
        student,
      ]);
    await warmPool(db);
    const results = await Promise.allSettled(Array.from({ length: 10 }, debit));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(4);
    expect(await getBalance(db, student)).toBe(0);
  });

  it("is append-only", async () => {
    const { db } = await setup();
    await expect(db.query("UPDATE {schema}.ledger SET amount_kobo = 999999")).rejects.toThrow(/append-only/);
    await expect(db.query("DELETE FROM {schema}.ledger")).rejects.toThrow(/append-only/);
    await expect(db.query("TRUNCATE {schema}.ledger")).rejects.toThrow(/append-only/);
  });

  it("rejects purchases recorded as credits", async () => {
    const { db, student } = await setup();
    await expect(
      db.query("INSERT INTO {schema}.ledger (user_id, kind, amount_kobo, created_at) VALUES ($1, 'purchase', 500, now())", [
        student,
      ]),
    ).rejects.toThrow();
  });
});

describe("verifying a ticket", () => {
  it("accepts a fresh ticket once, then reports ALREADY USED with time and vehicle", async () => {
    const { db, student, conductor, route } = await setup();
    const ticket = await purchaseTicket(db, testKeys, student, route, { now: NOW });
    const vehicle = { name: "Bus 3", routeId: route, routeName: "Main Gate – SUB" };

    const first = await verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, vehicle, now: NOW + 42 * 60_000 });
    expect(first.outcome).toBe("valid");

    const second = await verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, now: NOW + HOUR });
    expect(second.outcome).toBe("already_used");
    expect(second.headline).toBe("ALREADY USED at 10:42 on Bus 3");
    expect((await listFraud(db)).map((f) => f.kind)).toEqual(["reuse"]);
  });

  it("also accepts the backup code, typed loosely, and it is single-use too", async () => {
    const { db, student, conductor, route } = await setup();
    const ticket = await purchaseTicket(db, testKeys, student, route, { now: NOW });
    const typed = ticket.shortCode.toLowerCase().replace("-", " ");
    expect((await verifyAndRedeem(db, testKeys, typed, { conductorId: conductor, now: NOW })).outcome).toBe("valid");
    expect((await verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, now: NOW })).outcome).toBe(
      "already_used",
    );
  });

  it("reports EXPIRED after the expiry time and does not use the ticket", async () => {
    const { db, student, conductor, route } = await setup();
    const ticket = await purchaseTicket(db, testKeys, student, route, { now: NOW, ttlMs: HOUR });
    const late = await verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, now: NOW + HOUR });
    expect(late.outcome).toBe("expired");
    expect(late.headline).toBe("EXPIRED");
    expect((await listOwnTickets(db, student, NOW + HOUR))[0].status).toBe("expired");
  });

  it("reports INVALID for tampered, forged and unknown codes, and logs them", async () => {
    const { db, student, conductor, route } = await setup();
    const ticket = await purchaseTicket(db, testKeys, student, route, { now: NOW });
    const [prefix, payload, sig] = ticket.token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    const longer = Buffer.from(JSON.stringify({ ...claims, exp: claims.exp + 86400 })).toString("base64url");
    const ctx = { conductorId: conductor, now: NOW };

    expect((await verifyAndRedeem(db, testKeys, `${prefix}.${longer}.${sig}`, ctx)).headline).toBe("INVALID");
    expect((await verifyAndRedeem(db, testKeys, "not a ticket!", ctx)).outcome).toBe("invalid");
    expect((await verifyAndRedeem(db, testKeys, "ZZZZZ-ZZZZZ", ctx)).outcome).toBe("invalid");
    // Correctly signed, but for a ticket that was never sold.
    const ghost = signTicket({ ...claims, tid: "never-sold" }, testKeys);
    expect((await verifyAndRedeem(db, testKeys, ghost, ctx)).outcome).toBe("invalid");

    expect((await listFraud(db)).map((f) => f.kind).sort()).toEqual([
      "bad_format",
      "bad_signature",
      "bad_signature",
      "unknown_code",
    ]);
    // The real ticket is still usable after all that.
    expect((await verifyAndRedeem(db, testKeys, ticket.token, ctx)).outcome).toBe("valid");
  });

  it("reports WRONG ROUTE on a vehicle serving another route and leaves the ticket unused", async () => {
    const { db, student, conductor, route, otherRoute } = await setup();
    const ticket = await purchaseTicket(db, testKeys, student, route, { now: NOW });
    const bus4 = { name: "Bus 4", routeId: otherRoute, routeName: "Moremi Hall – Senate" };
    expect((await verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, vehicle: bus4, now: NOW })).outcome).toBe(
      "wrong_route",
    );
    const anyRoute = { name: "Shuttle 5", routeId: null, routeName: null };
    expect(
      (await verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, vehicle: anyRoute, now: NOW })).outcome,
    ).toBe("valid");
  });

  it("lets exactly one of many simultaneous scans succeed", async () => {
    const { db, student, conductor, route } = await setup();
    const ticket = await purchaseTicket(db, testKeys, student, route, { now: NOW });
    await warmPool(db);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, now: NOW })),
    );
    expect(results.filter((r) => r.outcome === "valid")).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "already_used")).toHaveLength(19);
  });
});

describe("redemption across separate database connections", () => {
  it("lets only one connection redeem even if both saw the ticket unused", async () => {
    const { db: a, student, conductor, route } = await setup();
    const b = await secondConnection(a); // like a second server process (a real one when DATABASE_URL is set)
    const ticket = await purchaseTicket(a, testKeys, student, route, { now: NOW });

    // Both connections read the ticket as unused...
    const read = "SELECT status FROM {schema}.tickets WHERE id = $1";
    expect((await a.one<{ status: string }>(read, [ticket.id])).status).toBe("active");
    expect((await b.one<{ status: string }>(read, [ticket.id])).status).toBe("active");

    // ...but the guarded UPDATE lets only one writer through, even when both race.
    const [first, second] = await Promise.all([
      verifyAndRedeem(b, testKeys, ticket.token, { conductorId: conductor, now: NOW }),
      verifyAndRedeem(a, testKeys, ticket.token, { conductorId: conductor, now: NOW }),
    ]);
    expect([first.outcome, second.outcome].sort()).toEqual(["already_used", "valid"]);
    if (b !== a) await b.close();
    await a.close();
  });
});

describe("refunds", () => {
  it("returns the fare for an unused ticket, once, and the ticket stops working", async () => {
    const { db, student, conductor, route } = await setup();
    const admin = await userId(db, "ADM/001");
    const ticket = await purchaseTicket(db, testKeys, student, route, { now: NOW });
    expect((await refundTicket(db, ticket.id, admin, NOW)).status).toBe("refunded");
    expect(await getBalance(db, student)).toBe(2000_00);
    await expect(refundTicket(db, ticket.id, admin, NOW)).rejects.toThrow(/unused/);
    expect((await verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, now: NOW })).outcome).toBe("invalid");
  });

  it("refuses to refund a used ticket", async () => {
    const { db, student, conductor, route } = await setup();
    const ticket = await purchaseTicket(db, testKeys, student, route, { now: NOW });
    await verifyAndRedeem(db, testKeys, ticket.token, { conductorId: conductor, now: NOW });
    await expect(refundTicket(db, ticket.id, await userId(db, "ADM/001"), NOW)).rejects.toThrow(/unused/);
  });

  it("refunds at most once when two admins race", async () => {
    const { db, student, route } = await setup();
    const admin = await userId(db, "ADM/001");
    const ticket = await purchaseTicket(db, testKeys, student, route, { now: NOW });
    await warmPool(db);
    const results = await Promise.allSettled([1, 2, 3].map(() => refundTicket(db, ticket.id, admin, NOW)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await getBalance(db, student)).toBe(2000_00);
  });
});
