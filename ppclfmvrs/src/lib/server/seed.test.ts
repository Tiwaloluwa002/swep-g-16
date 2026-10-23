import { describe, expect, it } from "vitest";
import { all, openDatabase } from "./db";
import { listLostByOwner } from "./items";
import { candidatesFor } from "./matches";
import { seedIfEmpty } from "./seed";
import { authenticate } from "./users";

describe("demo seed", () => {
  it("creates accounts and lost reports whose true match ranks first", () => {
    const db = openDatabase(":memory:");
    seedIfEmpty(db);
    seedIfEmpty(db); // idempotent
    const tolu = authenticate(db, "CSC/2021/045", "owner-pass-1")!;
    const phone = listLostByOwner(db, tolu.id).find((l) => l.category === "phone")!;
    const candidates = candidatesFor(db, phone);
    expect(candidates[0].found.description).toMatch(/reading table/);
    expect(all(db, "SELECT * FROM notifications WHERE user_id = ?", tolu.id).length).toBeGreaterThan(0);
    expect(all(db, "SELECT * FROM users").length).toBe(6);
  });
});
