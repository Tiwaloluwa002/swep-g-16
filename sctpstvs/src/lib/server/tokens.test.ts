import { describe, expect, it } from "vitest";
import { generateSigningKeys } from "@/lib/server/keys";
import { formatShortCode, newShortCode, normaliseShortCode, signTicket, verifyTicketToken } from "@/lib/server/tokens";

const keys = generateSigningKeys();
const claims = { tid: "abc123", rid: 1, iat: 1_700_000_000, exp: 1_700_007_200, kid: keys.keyId };

describe("ticket tokens", () => {
  it("verifies a token it signed and returns its claims", () => {
    const result = verifyTicketToken(signTicket(claims, keys), keys);
    expect(result).toEqual({ ok: true, claims });
  });

  it("rejects a token whose payload was edited", () => {
    const [prefix, payload, sig] = signTicket(claims, keys).split(".");
    const forged = Buffer.from(JSON.stringify({ ...claims, rid: 2 })).toString("base64url");
    expect(verifyTicketToken(`${prefix}.${forged}.${sig}`, keys)).toEqual({ ok: false, reason: "bad_signature" });
    // Flipping one character of the original payload must also fail.
    const flipped = payload.slice(0, -1) + (payload.at(-1) === "A" ? "B" : "A");
    expect(verifyTicketToken(`${prefix}.${flipped}.${sig}`, keys).ok).toBe(false);
  });

  it("rejects a token whose signature was edited", () => {
    const token = signTicket(claims, keys);
    const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    expect(verifyTicketToken(tampered, keys).ok).toBe(false);
  });

  it("rejects a token signed with another key", () => {
    const other = generateSigningKeys();
    const token = signTicket({ ...claims, kid: keys.keyId }, other);
    expect(verifyTicketToken(token, keys)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "SCT1", "SCT1.abc", "SCT2.a.b", "SCT1.a b.c", `SCT1.${"a".repeat(600)}.b`]) {
      expect(verifyTicketToken(bad, keys)).toEqual({ ok: false, reason: "bad_format" });
    }
  });
});

describe("backup codes", () => {
  it("are 10 unambiguous characters", () => {
    const code = newShortCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
    expect(formatShortCode(code)).toMatch(/^.{5}-.{5}$/);
  });

  it("normalise case, dashes and look-alike letters", () => {
    expect(normaliseShortCode("ab1cd-ef2gh")).toBe("AB1CDEF2GH");
    expect(normaliseShortCode("o1lI0 -abcde")).toBe("01110ABCDE");
    expect(normaliseShortCode("too-short")).toBeNull();
    expect(normaliseShortCode("ABCDE-FGHU!")).toBeNull();
  });
});
