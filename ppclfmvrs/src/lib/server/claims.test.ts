import { describe, expect, it } from "vitest";
import { ClaimError, CODE_TTL_MS, confirmHandover, getClaim, reissueCode, startClaim, verifyClaim } from "./claims";
import { createLost, getFound, getLost } from "./items";
import { MAX_ATTEMPTS_PER_DAY } from "./limits";
import { fixture, NOW } from "./test-helpers";

const later = (ms: number) => new Date(NOW.getTime() + ms);

function errorOf(fn: () => unknown): ClaimError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ClaimError) return err;
    throw err;
  }
  throw new Error("expected a ClaimError");
}

describe("verification", () => {
  it("accepts answers that differ only in case and spacing", () => {
    const { db, owner, lost, found } = fixture();
    const claim = startClaim(db, owner, lost.id, found.id, NOW);
    const result = verifyClaim(db, owner, claim.id, ["  blue   STAR ", "A Cat"], NOW);
    expect(result.outcome).toBe("verified");
    expect(getFound(db, found.id)!.status).toBe("pending_handover");
  });

  it("rejects a wrong answer and logs the attempt", () => {
    const { db, owner, lost, found } = fixture();
    const claim = startClaim(db, owner, lost.id, found.id, NOW);
    const result = verifyClaim(db, owner, claim.id, ["blue star", "dog"], NOW);
    expect(result).toEqual({ outcome: "wrong", attemptsLeft: 2, locked: false });
    expect(db.prepare("SELECT COUNT(*) AS n FROM claim_attempts WHERE success = 0").get()).toMatchObject({ n: 1 });
  });

  it("stores answers only as salted hashes", () => {
    const { db } = fixture();
    const rows = db.prepare("SELECT * FROM questions").all();
    const dump = JSON.stringify(rows).toLowerCase();
    expect(dump).not.toContain("blue star");
    expect(dump).not.toContain("cat");
    const salts = new Set(rows.map((r) => r.salt));
    expect(salts.size).toBe(rows.length);
  });

  it("refuses claims on items that do not match the report", () => {
    const { db, owner, found } = fixture();
    const wallet = createLost(db, owner.id, {
      category: "wallet", colour: "brown", brand: "", description: "wallet", locationId: "sub",
      lostDate: "2026-10-21", timeFrom: "00:00", timeTo: "23:59", privateDetails: {},
    }, NOW);
    expect(errorOf(() => startClaim(db, owner, wallet.id, found.id, NOW)).status).toBe(403);
  });

  it("does not let a finder claim their own item", () => {
    const { db, finder, lost, found } = fixture();
    expect(errorOf(() => startClaim(db, finder, lost.id, found.id, NOW)).status).toBe(404);
  });
});

describe("attempt limits", () => {
  it("locks a claim after three wrong answers", () => {
    const { db, owner, lost, found } = fixture();
    const claim = startClaim(db, owner, lost.id, found.id, NOW);
    verifyClaim(db, owner, claim.id, ["x", "y"], NOW);
    verifyClaim(db, owner, claim.id, ["x", "y"], NOW);
    const third = verifyClaim(db, owner, claim.id, ["x", "y"], NOW);
    expect(third).toEqual({ outcome: "wrong", attemptsLeft: 0, locked: true });
    expect(getClaim(db, claim.id)!.status).toBe("locked");
    // Even the right answers are refused once locked.
    expect(errorOf(() => verifyClaim(db, owner, claim.id, ["blue star", "a cat"], NOW)).status).toBe(429);
  });

  it("caps attempts per user per day across claims", () => {
    const { db, owner, found } = fixture();
    const claims = Array.from({ length: 3 }, (_, i) => {
      const lost = createLost(db, owner.id, {
        category: "phone", colour: "black", brand: "", description: `black phone clear case ${i}`, locationId: "library",
        lostDate: "2026-10-21", timeFrom: "00:00", timeTo: "23:59", privateDetails: {},
      }, NOW);
      return startClaim(db, owner, lost.id, found.id, NOW);
    });
    let made = 0;
    for (const claim of claims) {
      for (let i = 0; i < 2 && made < MAX_ATTEMPTS_PER_DAY; i++, made++) verifyClaim(db, owner, claim.id, ["x", "y"], NOW);
    }
    expect(made).toBe(MAX_ATTEMPTS_PER_DAY);
    expect(errorOf(() => verifyClaim(db, owner, claims[2].id, ["blue star", "a cat"], NOW)).status).toBe(429);
    // The window rolls: a day later the user may try again.
    expect(verifyClaim(db, owner, claims[2].id, ["blue star", "a cat"], later(25 * 3600_000)).outcome).toBe("verified");
  });
});

describe("handover codes", () => {
  function verified() {
    const f = fixture();
    const claim = startClaim(f.db, f.owner, f.lost.id, f.found.id, NOW);
    const result = verifyClaim(f.db, f.owner, claim.id, ["blue star", "a cat"], NOW);
    if (result.outcome !== "verified") throw new Error("setup failed");
    return { ...f, claim, code: result.code };
  }

  it("are single-use and mark the item recovered", () => {
    const { db, officer, code, found, lost } = verified();
    confirmHandover(db, officer, code.toLowerCase().replace("-", " "), later(1000));
    expect(getFound(db, found.id)!.status).toBe("recovered");
    expect(getLost(db, lost.id)!.status).toBe("recovered");
    expect(errorOf(() => confirmHandover(db, officer, code, later(2000))).status).toBe(409);
  });

  it("expire", () => {
    const { db, officer, code } = verified();
    expect(errorOf(() => confirmHandover(db, officer, code, later(CODE_TTL_MS + 1))).status).toBe(410);
  });

  it("stop working when the owner gets a new one", () => {
    const { db, owner, officer, claim, code } = verified();
    const fresh = reissueCode(db, owner, claim.id, later(1000));
    expect(errorOf(() => confirmHandover(db, officer, code, later(2000))).status).toBe(410);
    expect(confirmHandover(db, officer, fresh.code, later(3000)).claimId).toBe(claim.id);
  });

  it("can only be accepted by the desk holding the item", () => {
    const { db, subOfficer, other, code } = verified();
    expect(errorOf(() => confirmHandover(db, subOfficer, code, later(1000))).status).toBe(403);
    expect(errorOf(() => confirmHandover(db, other, code, later(1000))).status).toBe(403);
  });

  it("are stored only as hashes", () => {
    const { db, code } = verified();
    expect(JSON.stringify(db.prepare("SELECT * FROM handover_codes").all())).not.toContain(code);
  });

  it("reject unknown codes", () => {
    const { db, officer } = verified();
    expect(errorOf(() => confirmHandover(db, officer, "AAAA-BBBB", later(1000))).status).toBe(404);
  });
});
