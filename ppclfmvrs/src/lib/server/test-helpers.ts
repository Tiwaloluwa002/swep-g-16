import { randomUUID } from "node:crypto";
import { afterAll } from "vitest";
import { connectPglite, connectPostgres, type Db, migrate } from "./db";
import { createFound, createLost } from "./items";
import { createUser } from "./users";

export const NOW = new Date("2026-10-22T12:00:00Z");

/*
 * Tests run on in-memory PGlite (one per test file, so no server is needed),
 * or on a real Postgres when TEST_DATABASE_URL is set. Either way each test
 * gets its own fresh schema, so tests never see each other's rows.
 */
const realUrl = process.env.TEST_DATABASE_URL;
let engine: Promise<Db> | undefined;
const created: Db[] = [];

export async function freshDb(): Promise<Db> {
  engine ??= realUrl ? connectPostgres(realUrl, "public") : connectPglite(undefined, "public");
  const db = (await engine).withSchema(`ppcl_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`);
  await migrate(db);
  created.push(db);
  return db;
}

afterAll(async () => {
  // Real Postgres only: drop the schemas this file created. PGlite memory just goes away.
  if (!realUrl) return;
  for (const db of created) await db.query(`DROP SCHEMA IF EXISTS ${db.schema} CASCADE`);
});

/** A fresh database with an owner, a finder, a desk officer and one matching pair. */
export async function fixture() {
  const db = await freshDb();
  const owner = await createUser(db, { ident: "csc/2021/001", name: "Owner", role: "member", password: "pw-owner", phone: "08011111111", email: "owner@example.com" }, NOW);
  const finder = await createUser(db, { ident: "EEG/2020/002", name: "Finder", role: "member", password: "pw-finder", phone: "08022222222", email: "finder@example.com" }, NOW);
  const other = await createUser(db, { ident: "ECN/2022/003", name: "Other", role: "member", password: "pw-other" }, NOW);
  const officer = await createUser(db, { ident: "SEC/1", name: "Officer", role: "desk", deskId: "security", password: "pw-desk" }, NOW);
  const subOfficer = await createUser(db, { ident: "SUB/1", name: "SUB Officer", role: "desk", deskId: "sub", password: "pw-desk" }, NOW);

  const lost = await createLost(db, owner.id, {
    category: "phone",
    colour: "black",
    brand: "Tecno",
    description: "Tecno phone in a clear case",
    locationId: "library",
    lostDate: "2026-10-21",
    timeFrom: "10:00",
    timeTo: "12:00",
    privateDetails: { serialLastDigits: "4417", lockScreen: "cat on a red sofa", uniqueMarks: "blue star sticker" },
  }, NOW);
  const found = await createFound(db, finder.id, {
    category: "phone",
    colour: "black",
    locationId: "library",
    foundDate: "2026-10-21",
    description: "Black phone in a clear case",
    custody: "desk",
    deskId: "security",
    meetLocationId: null,
    questions: [
      { question: "What sticker is on the back?", answer: "Blue Star" },
      { question: "What is on the lock screen?", answer: "a cat" },
    ],
  }, NOW);
  return { db, owner, finder, other, officer, subOfficer, lost, found };
}

/** Awaits fn and returns the error it throws (of the given class). */
export async function errorOf<E extends Error>(fn: () => Promise<unknown>, type: new (...args: never[]) => E): Promise<E> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof type) return err;
    throw err;
  }
  throw new Error(`expected a ${type.name}`);
}
