import { openDatabase } from "./db";
import { createFound, createLost } from "./items";
import { createUser } from "./users";

export const NOW = new Date("2026-10-22T12:00:00Z");

/** A fresh in-memory database with an owner, a finder, a desk officer and one matching pair. */
export function fixture() {
  const db = openDatabase(":memory:");
  const owner = createUser(db, { ident: "csc/2021/001", name: "Owner", role: "member", password: "pw-owner", phone: "08011111111", email: "owner@example.com" }, NOW);
  const finder = createUser(db, { ident: "EEG/2020/002", name: "Finder", role: "member", password: "pw-finder", phone: "08022222222", email: "finder@example.com" }, NOW);
  const other = createUser(db, { ident: "ECN/2022/003", name: "Other", role: "member", password: "pw-other" }, NOW);
  const officer = createUser(db, { ident: "SEC/1", name: "Officer", role: "desk", deskId: "security", password: "pw-desk" }, NOW);
  const subOfficer = createUser(db, { ident: "SUB/1", name: "SUB Officer", role: "desk", deskId: "sub", password: "pw-desk" }, NOW);

  const lost = createLost(db, owner.id, {
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
  const found = createFound(db, finder.id, {
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
