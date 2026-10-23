import { describe, expect, it } from "vitest";
import { colourScore, dateScore, keywordScore, locationScore, rankMatches, scoreMatch } from "./matching";
import type { FoundSide, LostSide } from "./matching";

const lostPhone: LostSide = {
  category: "phone",
  colour: "black",
  brand: "Tecno",
  description: "Tecno Camon phone in a clear case with a blue sticker",
  locationId: "library",
  lostDate: "2026-10-20",
};

const found = (over: Partial<FoundSide> & { id: string }) => ({
  category: "phone" as const,
  colour: "black",
  description: "black phone in a clear case",
  locationId: "library",
  foundDate: "2026-10-20",
  ...over,
});

describe("scoreMatch", () => {
  it("never matches a different category", () => {
    expect(scoreMatch(lostPhone, found({ id: "x", category: "wallet" }))).toBeNull();
  });

  it("gives an identical pair a near-perfect score", () => {
    const m = scoreMatch(lostPhone, found({ id: "x", description: "Tecno Camon phone clear case blue sticker" }));
    expect(m!.score).toBeGreaterThan(0.9);
  });

  it("returns a breakdown between 0 and 1 for every factor", () => {
    const m = scoreMatch(lostPhone, found({ id: "x", colour: "grey", locationId: "sub", foundDate: "2026-10-25" }))!;
    for (const v of Object.values(m.breakdown)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("factor scores", () => {
  it("treats similar colours as partial matches", () => {
    expect(colourScore("black", "black")).toBe(1);
    expect(colourScore("black", "grey")).toBe(0.5);
    expect(colourScore("black", "red")).toBe(0);
  });

  it("scores nearby places above distant ones", () => {
    expect(locationScore("library", "library")).toBe(1);
    const nearby = locationScore("library", "senate");
    const far = locationScore("library", "angola");
    expect(nearby).toBeGreaterThan(0.5);
    expect(far).toBe(0);
  });

  it("rejects finds well before the loss and decays over two weeks", () => {
    expect(dateScore("2026-10-20", "2026-10-15")).toBe(0);
    expect(dateScore("2026-10-20", "2026-10-19")).toBe(0.5);
    expect(dateScore("2026-10-20", "2026-10-21")).toBe(1);
    expect(dateScore("2026-10-20", "2026-10-27")).toBeGreaterThan(0);
    expect(dateScore("2026-10-20", "2026-11-10")).toBe(0);
  });

  it("ignores stopwords and plurals in keyword overlap", () => {
    expect(keywordScore("the keys", "key")).toBe(1);
    expect(keywordScore("a red bag", "blue laptop")).toBe(0);
  });
});

describe("rankMatches", () => {
  it("ranks the true pair first", () => {
    const candidates = [
      found({ id: "far", locationId: "angola", foundDate: "2026-10-28", description: "phone" }),
      found({ id: "true", description: "black Tecno phone, clear case, blue sticker on back" }),
      found({ id: "colour", colour: "white", locationId: "sub", description: "white phone" }),
      found({ id: "wallet", category: "wallet", description: "Tecno clear case blue sticker" }),
    ];
    const ranked = rankMatches(lostPhone, candidates);
    expect(ranked[0].found.id).toBe("true");
    expect(ranked.map((r) => r.found.id)).not.toContain("wallet");
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
  });

  it("hides candidates below the threshold", () => {
    const weak = found({ id: "weak", colour: "red", locationId: "angola", foundDate: "2026-11-30", description: "x" });
    expect(rankMatches(lostPhone, [weak])).toEqual([]);
  });
});
