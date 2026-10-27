import { describe, expect, it } from "vitest";
import type { Claim } from "@/lib/types";
import { ClaimError, CODE_TTL_MS, confirmHandover, getClaim, reissueCode, startClaim, verifyClaim } from "./claims";
import { all, count } from "./db";
import { createFound, createLost, getFound, getLost } from "./items";
import { MAX_ATTEMPTS_PER_CLAIM, MAX_ATTEMPTS_PER_DAY } from "./limits";
import { errorOf as errorOfType, fixture, NOW } from "./test-helpers";

const later = (ms: number) => new Date(NOW.getTime() + ms);
const errorOf = (fn: () => Promise<unknown>) => errorOfType(fn, ClaimError);

describe("verification", () => {
  it("accepts answers that differ only in case and spacing", async () => {
    const { db, owner, lost, found } = await fixture();
    const claim = await startClaim(db, owner, lost.id, found.id, NOW);
    const result = await verifyClaim(db, owner, claim.id, ["  blue   STAR ", "A Cat"], NOW);
    expect(result.outcome).toBe("verified");
    expect((await getFound(db, found.id))!.status).toBe("pending_handover");
  });

  it("rejects a wrong answer and logs the attempt", async () => {
    const { db, owner, lost, found } = await fixture();
    const claim = await startClaim(db, owner, lost.id, found.id, NOW);
    const result = await verifyClaim(db, owner, claim.id, ["blue star", "dog"], NOW);
    expect(result).toEqual({ outcome: "wrong", attemptsLeft: 2, locked: false });
    expect(await count(db, "SELECT COUNT(*)::int AS n FROM {schema}.claim_attempts WHERE NOT success")).toBe(1);
  });

  it("stores answers only as salted hashes", async () => {
    const { db } = await fixture();
    const rows = await all(db, "SELECT * FROM {schema}.questions");
    const dump = JSON.stringify(rows).toLowerCase();
    expect(dump).not.toContain("blue star");
    expect(dump).not.toContain("cat");
    const salts = new Set(rows.map((r) => r.salt));
    expect(salts.size).toBe(rows.length);
  });

  it("refuses claims on items that do not match the report", async () => {
    const { db, owner, found } = await fixture();
    const wallet = await createLost(db, owner.id, {
      category: "wallet", colour: "brown", brand: "", description: "wallet", locationId: "sub",
      lostDate: "2026-10-21", timeFrom: "00:00", timeTo: "23:59", privateDetails: {},
    }, NOW);
    expect((await errorOf(() => startClaim(db, owner, wallet.id, found.id, NOW))).status).toBe(403);
  });

  it("does not let a finder claim their own item", async () => {
    const { db, finder, lost, found } = await fixture();
    expect((await errorOf(() => startClaim(db, finder, lost.id, found.id, NOW))).status).toBe(404);
  });

  it("returns the same claim when two requests start it at once", async () => {
    const { db, owner, lost, found } = await fixture();
    const claims = await Promise.all(Array.from({ length: 4 }, () => startClaim(db, owner, lost.id, found.id, NOW)));
    expect(new Set(claims.map((c) => c.id)).size).toBe(1);
    expect(await count(db, "SELECT COUNT(*)::int AS n FROM {schema}.claims")).toBe(1);
  });
});

describe("attempt limits", () => {
  it("locks a claim after three wrong answers", async () => {
    const { db, owner, lost, found } = await fixture();
    const claim = await startClaim(db, owner, lost.id, found.id, NOW);
    await verifyClaim(db, owner, claim.id, ["x", "y"], NOW);
    await verifyClaim(db, owner, claim.id, ["x", "y"], NOW);
    const third = await verifyClaim(db, owner, claim.id, ["x", "y"], NOW);
    expect(third).toEqual({ outcome: "wrong", attemptsLeft: 0, locked: true });
    expect((await getClaim(db, claim.id))!.status).toBe("locked");
    // Even the right answers are refused once locked.
    expect((await errorOf(() => verifyClaim(db, owner, claim.id, ["blue star", "a cat"], NOW))).status).toBe(429);
  });

  it("caps attempts per user per day across claims", async () => {
    const { db, owner, found } = await fixture();
    const claims: Claim[] = [];
    for (let i = 0; i < 3; i++) {
      const lost = await createLost(db, owner.id, {
        category: "phone", colour: "black", brand: "", description: `black phone clear case ${i}`, locationId: "library",
        lostDate: "2026-10-21", timeFrom: "00:00", timeTo: "23:59", privateDetails: {},
      }, NOW);
      claims.push(await startClaim(db, owner, lost.id, found.id, NOW));
    }
    let made = 0;
    for (const claim of claims) {
      for (let i = 0; i < 2 && made < MAX_ATTEMPTS_PER_DAY; i++, made++) await verifyClaim(db, owner, claim.id, ["x", "y"], NOW);
    }
    expect(made).toBe(MAX_ATTEMPTS_PER_DAY);
    expect((await errorOf(() => verifyClaim(db, owner, claims[2].id, ["blue star", "a cat"], NOW))).status).toBe(429);
    // The window rolls: a day later the user may try again.
    expect((await verifyClaim(db, owner, claims[2].id, ["blue star", "a cat"], later(25 * 3600_000))).outcome).toBe("verified");
  });

  it("hold under parallel wrong answers on one claim", async () => {
    const { db, owner, lost, found } = await fixture();
    const claim = await startClaim(db, owner, lost.id, found.id, NOW);
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => verifyClaim(db, owner, claim.id, ["x", "y"], NOW)));
    const wrong = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter((r) => r.status === "rejected" && (r.reason as ClaimError).status === 429);
    expect(wrong).toHaveLength(MAX_ATTEMPTS_PER_CLAIM);
    expect(refused).toHaveLength(8 - MAX_ATTEMPTS_PER_CLAIM);
    expect(await count(db, "SELECT COUNT(*)::int AS n FROM {schema}.claim_attempts")).toBe(MAX_ATTEMPTS_PER_CLAIM);
    expect((await getClaim(db, claim.id))!).toMatchObject({ status: "locked", attempts: MAX_ATTEMPTS_PER_CLAIM });
  });

  it("hold under parallel wrong answers spread over many claims", async () => {
    const { db, owner, finder } = await fixture();
    // Six different found items, so only the per-user limit links these claims.
    const claims: Claim[] = [];
    for (let i = 0; i < 6; i++) {
      const lost = await createLost(db, owner.id, {
        category: "phone", colour: "black", brand: "", description: `black phone clear case ${i}`, locationId: "library",
        lostDate: "2026-10-21", timeFrom: "00:00", timeTo: "23:59", privateDetails: {},
      }, NOW);
      const found = await createFound(db, finder.id, {
        category: "phone", colour: "black", locationId: "library", foundDate: "2026-10-21", description: `black phone clear case ${i}`,
        custody: "desk", deskId: "security", meetLocationId: null,
        questions: [{ question: "Sticker?", answer: "star" }, { question: "Lock screen?", answer: "cat" }],
      }, NOW);
      claims.push(await startClaim(db, owner, lost.id, found.id, NOW));
    }
    for (const claim of claims.slice(0, 3)) await verifyClaim(db, owner, claim.id, ["x", "y"], NOW);
    // 3 used; 6 more arrive at once on different claims, but only 2 fit in the day's 5.
    const results = await Promise.allSettled(claims.map((c) => verifyClaim(db, owner, c.id, ["x", "y"], NOW)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(MAX_ATTEMPTS_PER_DAY - 3);
    expect(await count(db, "SELECT COUNT(*)::int AS n FROM {schema}.claim_attempts")).toBe(MAX_ATTEMPTS_PER_DAY);
  });

  it("let only one of two owners win the same item when they verify at once", async () => {
    const { db, owner, other, lost, found } = await fixture();
    const otherLost = await createLost(db, other.id, {
      category: "phone", colour: "black", brand: "Tecno", description: "black phone clear case", locationId: "library",
      lostDate: "2026-10-21", timeFrom: "00:00", timeTo: "23:59", privateDetails: {},
    }, NOW);
    const a = await startClaim(db, owner, lost.id, found.id, NOW);
    const b = await startClaim(db, other, otherLost.id, found.id, NOW);
    const results = await Promise.allSettled([
      verifyClaim(db, owner, a.id, ["blue star", "a cat"], NOW),
      verifyClaim(db, other, b.id, ["blue star", "a cat"], NOW),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await count(db, "SELECT COUNT(*)::int AS n FROM {schema}.claims WHERE status = 'verified'")).toBe(1);
    expect(await count(db, "SELECT COUNT(*)::int AS n FROM {schema}.handover_codes")).toBe(1);
  });
});

describe("handover codes", () => {
  async function verified() {
    const f = await fixture();
    const claim = await startClaim(f.db, f.owner, f.lost.id, f.found.id, NOW);
    const result = await verifyClaim(f.db, f.owner, claim.id, ["blue star", "a cat"], NOW);
    if (result.outcome !== "verified") throw new Error("setup failed");
    return { ...f, claim, code: result.code };
  }

  it("are single-use and mark the item recovered", async () => {
    const { db, officer, code, found, lost } = await verified();
    await confirmHandover(db, officer, code.toLowerCase().replace("-", " "), later(1000));
    expect((await getFound(db, found.id))!.status).toBe("recovered");
    expect((await getLost(db, lost.id))!.status).toBe("recovered");
    expect((await errorOf(() => confirmHandover(db, officer, code, later(2000)))).status).toBe(409);
  });

  it("are accepted only once when presented in parallel", async () => {
    const { db, officer, code } = await verified();
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => confirmHandover(db, officer, code, later(1000))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) if (r.status === "rejected") expect((r.reason as ClaimError).status).toBe(409);
    expect(await count(db, "SELECT COUNT(*)::int AS n FROM {schema}.handover_codes WHERE used_at IS NOT NULL")).toBe(1);
  });

  it("stay consistent when a new code is issued while the old one is presented", async () => {
    const { db, owner, officer, claim, code } = await verified();
    const [confirm, reissue] = await Promise.allSettled([
      confirmHandover(db, officer, code, later(1000)),
      reissueCode(db, owner, claim.id, later(1000)),
    ]);
    // Either the old code was used first (and reissuing is refused), or it was replaced first (and is refused).
    if (confirm.status === "fulfilled") {
      expect(reissue.status === "rejected" && (reissue.reason as ClaimError).status).toBe(409);
    } else {
      expect((confirm.reason as ClaimError).status).toBe(410);
      expect(reissue.status).toBe("fulfilled");
    }
    expect(await count(db, "SELECT COUNT(*)::int AS n FROM {schema}.handover_codes WHERE used_at IS NOT NULL AND revoked")).toBe(0);
  });

  it("expire", async () => {
    const { db, officer, code } = await verified();
    expect((await errorOf(() => confirmHandover(db, officer, code, later(CODE_TTL_MS + 1)))).status).toBe(410);
  });

  it("stop working when the owner gets a new one", async () => {
    const { db, owner, officer, claim, code } = await verified();
    const fresh = await reissueCode(db, owner, claim.id, later(1000));
    expect((await errorOf(() => confirmHandover(db, officer, code, later(2000)))).status).toBe(410);
    expect((await confirmHandover(db, officer, fresh.code, later(3000))).claimId).toBe(claim.id);
  });

  it("can only be accepted by the desk holding the item", async () => {
    const { db, subOfficer, other, code } = await verified();
    expect((await errorOf(() => confirmHandover(db, subOfficer, code, later(1000)))).status).toBe(403);
    expect((await errorOf(() => confirmHandover(db, other, code, later(1000)))).status).toBe(403);
  });

  it("are stored only as hashes", async () => {
    const { db, code } = await verified();
    expect(JSON.stringify(await all(db, "SELECT * FROM {schema}.handover_codes"))).not.toContain(code);
  });

  it("reject unknown codes", async () => {
    const { db, officer } = await verified();
    expect((await errorOf(() => confirmHandover(db, officer, "AAAA-BBBB", later(1000)))).status).toBe(404);
  });
});
