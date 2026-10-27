import { describe, expect, it } from "vitest";
import { all } from "./db";
import { listLostByOwner } from "./items";
import { candidatesFor } from "./matches";
import { seedIfEmpty } from "./seed";
import { freshDb } from "./test-helpers";
import { authenticate } from "./users";

describe("demo seed", () => {
  it("creates accounts and lost reports whose true match ranks first", async () => {
    const db = await freshDb();
    await seedIfEmpty(db);
    await seedIfEmpty(db); // idempotent
    const tolu = (await authenticate(db, "CSC/2021/045", "owner-pass-1"))!;
    const phone = (await listLostByOwner(db, tolu.id)).find((l) => l.category === "phone")!;
    const candidates = await candidatesFor(db, phone);
    expect(candidates[0].found.description).toMatch(/reading table/);
    expect((await all(db, "SELECT * FROM {schema}.notifications WHERE user_id = $1", tolu.id)).length).toBeGreaterThan(0);
    expect((await all(db, "SELECT * FROM {schema}.users")).length).toBe(6);
  });

  it("seeds once even when two server instances start together", async () => {
    const db = await freshDb();
    await Promise.all([seedIfEmpty(db), seedIfEmpty(db), seedIfEmpty(db)]);
    expect((await all(db, "SELECT * FROM {schema}.users")).length).toBe(6);
    expect((await all(db, "SELECT * FROM {schema}.found_items")).length).toBe(4);
  });
});
