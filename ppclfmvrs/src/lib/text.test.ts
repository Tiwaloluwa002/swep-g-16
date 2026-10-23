import { describe, expect, it } from "vitest";
import { findSensitiveText, normalizeAnswer, tokenize } from "./text";

describe("normalizeAnswer", () => {
  it("trims, lowercases and collapses spaces", () => {
    expect(normalizeAnswer("  Blue   STAR\tsticker ")).toBe("blue star sticker");
  });
});

describe("tokenize", () => {
  it("drops stopwords and strips plurals", () => {
    expect([...tokenize("The black Keys with a lanyard")]).toEqual(["black", "key", "lanyard"]);
  });
});

describe("findSensitiveText", () => {
  it("flags contact details and identifying numbers", () => {
    expect(findSensitiveText("call me on 08031234567")).toContain("phone");
    expect(findSensitiveText("mail ada@example.com")).toContain("email");
    expect(findSensitiveText("ID belongs to CSC/2019/045")).toContain("matric-number");
    expect(findSensitiveText("IMEI 356789012345678")).toContain("long-number");
  });

  it("accepts a generic description", () => {
    expect(findSensitiveText("Black phone in a clear case, found near the library steps")).toEqual([]);
  });
});
