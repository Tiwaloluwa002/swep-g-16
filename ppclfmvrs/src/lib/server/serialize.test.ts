import { describe, expect, it } from "vitest";
import { claimView, startClaim, verifyClaim } from "./claims";
import { listDeskItems, listFailedAttempts } from "./desk";
import { listQuestions } from "./items";
import { candidatesFor } from "./matches";
import { assertNoLeaks, ownFound, ownLost, PrivacyLeakError, publicFound, publicLost, sessionUser } from "./serialize";
import { fixture, NOW } from "./test-helpers";

const SECRETS = ["4417", "cat on a red sofa", "blue star sticker", "08011111111", "08022222222", "owner@example.com", "finder@example.com"];

function expectNoSecrets(value: unknown, extra: string[] = []) {
  const json = JSON.stringify(value);
  for (const secret of [...SECRETS, ...extra]) expect(json).not.toContain(secret);
  assertNoLeaks(value);
}

describe("public serializers", () => {
  it("never expose private details, hashes or identities", async () => {
    const { db, owner, finder, lost, found } = await fixture();
    const hashes = (await listQuestions(db, found.id)).flatMap((q) => [q.salt, q.answerHash]);
    const ids = [owner.id, finder.id, owner.passwordHash, finder.passwordHash];
    expectNoSecrets(publicLost(lost), [...hashes, ...ids]);
    expectNoSecrets(publicFound(found), [...hashes, ...ids]);
    expectNoSecrets(await candidatesFor(db, lost), [...hashes, ...ids]);
    expectNoSecrets(ownFound(found, ["What sticker is on the back?"], false), [...hashes, ...ids]);
    expectNoSecrets(sessionUser(owner), [owner.passwordHash]);
  });

  it("only copy allowlisted fields", async () => {
    const { found, lost } = await fixture();
    expect(Object.keys(publicFound(found)).sort()).toEqual(
      ["category", "colour", "createdAt", "custody", "description", "foundDate", "id", "locationId", "locationName", "status"].sort(),
    );
    expect(Object.keys(publicLost(lost))).not.toContain("privateDetails");
  });

  it("keep the claim view and desk views free of secrets, even after verification", async () => {
    const { db, owner, officer, lost, found } = await fixture();
    const claim = await startClaim(db, owner, lost.id, found.id, NOW);
    await verifyClaim(db, owner, claim.id, ["wrong", "wrong"], NOW);
    const result = await verifyClaim(db, owner, claim.id, ["blue star", "a cat"], NOW);
    const code = result.outcome === "verified" ? result.code : "";
    const view = await claimView(db, { ...claim, status: "verified" });
    expectNoSecrets(view, [code, "Blue Star"]);
    expectNoSecrets(await listDeskItems(db, officer), [code]);
    expectNoSecrets(await listFailedAttempts(db, officer));
  });

  it("let only the owner's own view carry private details", async () => {
    const { lost } = await fixture();
    const own = ownLost(lost);
    expect(own.privateDetails.serialLastDigits).toBe("4417");
    expect(() => assertNoLeaks(own)).toThrow(PrivacyLeakError);
    expect(() => assertNoLeaks(own, { allowPrivateDetails: true })).not.toThrow();
  });

  it("guard catches forbidden keys at any depth", () => {
    expect(() => assertNoLeaks({ items: [{ ok: 1, nested: { answerHash: "x" } }] })).toThrow(/items\[0\]\.nested\.answerHash/);
    expect(() => assertNoLeaks({ phone: "080" })).toThrow(PrivacyLeakError);
  });
});
