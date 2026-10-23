import { randomUUID } from "node:crypto";
import { getDesk, getLocation, isCategory, isColour } from "@/lib/catalog";
import { findSensitiveText, SENSITIVE_MESSAGES } from "@/lib/text";
import type { Category, Custody, FoundItem, FoundStatus, LostItem, LostStatus, PrivateDetails } from "@/lib/types";
import { hashAnswer, newSalt } from "./crypto";
import { all, type Db, one, type Row, run, transaction } from "./db";

export function toLost(row: Row): LostItem {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    category: row.category as Category,
    colour: String(row.colour),
    brand: String(row.brand),
    description: String(row.description),
    locationId: String(row.location_id),
    lostDate: String(row.lost_date),
    timeFrom: String(row.time_from),
    timeTo: String(row.time_to),
    privateDetails: JSON.parse(String(row.private_json)) as PrivateDetails,
    status: row.status as LostStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function toFound(row: Row): FoundItem {
  return {
    id: String(row.id),
    finderId: String(row.finder_id),
    category: row.category as Category,
    colour: String(row.colour),
    locationId: String(row.location_id),
    foundDate: String(row.found_date),
    description: String(row.description),
    custody: row.custody as Custody,
    deskId: (row.desk_id as string | null) ?? null,
    meetLocationId: (row.meet_location_id as string | null) ?? null,
    receivedAt: (row.received_at as string | null) ?? null,
    status: row.status as FoundStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// ---------- Input validation (untrusted request bodies) ----------

type Body = Record<string, unknown>;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function checkDate(value: string, now: Date): string | null {
  if (!DATE_RE.test(value) || Number.isNaN(Date.parse(value))) return "Enter a valid date.";
  // One day of slack for time zones.
  if (Date.parse(value) > now.getTime() + 86_400_000) return "The date cannot be in the future.";
  return null;
}

function checkPublicText(label: string, text: string): string | null {
  const found = findSensitiveText(text);
  if (found.length === 0) return null;
  return `${label} must not identify anyone. ${found.map((f) => SENSITIVE_MESSAGES[f]).join(" ")}`;
}

export type NewLost = Omit<LostItem, "id" | "ownerId" | "status" | "createdAt" | "updatedAt">;

export function parseNewLost(input: unknown, now = new Date()): NewLost | string {
  if (typeof input !== "object" || input === null) return "Invalid request body.";
  const b = input as Body;
  if (!isCategory(b.category)) return "Choose a category.";
  if (!isColour(b.colour)) return "Choose a colour.";
  if (typeof b.locationId !== "string" || !getLocation(b.locationId)) return "Choose where you last had it.";
  const description = str(b.description, 300);
  if (description.length < 3) return "Add a short public description.";
  const brand = str(b.brand, 60);
  const lostDate = str(b.lostDate, 10);
  const dateError = checkDate(lostDate, now);
  if (dateError) return dateError;
  const timeFrom = str(b.timeFrom, 5) || "00:00";
  const timeTo = str(b.timeTo, 5) || "23:59";
  if (!TIME_RE.test(timeFrom) || !TIME_RE.test(timeTo)) return "Enter valid times.";
  if (timeFrom > timeTo) return "The time window must start before it ends.";
  const publicError = checkPublicText("The public description", `${brand} ${description}`);
  if (publicError) return publicError;

  const p = (typeof b.privateDetails === "object" && b.privateDetails) as Body | false;
  const privateDetails: PrivateDetails = {};
  if (p) {
    for (const key of ["serialLastDigits", "lockScreen", "contents", "uniqueMarks"] as const) {
      const value = str(p[key], 200);
      if (value) privateDetails[key] = value;
    }
  }
  return {
    category: b.category,
    colour: b.colour,
    brand,
    description,
    locationId: b.locationId,
    lostDate,
    timeFrom,
    timeTo,
    privateDetails,
  };
}

export type NewQuestion = { question: string; answer: string };

export type NewFound = {
  category: Category;
  colour: string;
  locationId: string;
  foundDate: string;
  description: string;
  custody: Custody;
  deskId: string | null;
  meetLocationId: string | null;
  questions: NewQuestion[];
};

export function parseNewFound(input: unknown, now = new Date()): NewFound | string {
  if (typeof input !== "object" || input === null) return "Invalid request body.";
  const b = input as Body;
  if (!isCategory(b.category)) return "Choose a category.";
  if (!isColour(b.colour)) return "Choose a colour.";
  if (typeof b.locationId !== "string" || !getLocation(b.locationId)) return "Choose where you found it.";
  const foundDate = str(b.foundDate, 10);
  const dateError = checkDate(foundDate, now);
  if (dateError) return dateError;
  const description = str(b.description, 200);
  if (description.length < 3) return "Add a short, generic description.";
  const publicError = checkPublicText("The description", description);
  if (publicError) return publicError;

  let deskId: string | null = null;
  let meetLocationId: string | null = null;
  if (b.custody === "desk") {
    if (!getDesk(b.deskId as string)) return "Choose the collection desk.";
    deskId = b.deskId as string;
  } else if (b.custody === "finder") {
    if (typeof b.meetLocationId !== "string" || !getLocation(b.meetLocationId)) {
      return "Choose a public place to meet the owner.";
    }
    meetLocationId = b.meetLocationId;
  } else {
    return "Say where the item is now.";
  }

  const rawQuestions = Array.isArray(b.questions) ? b.questions : [];
  const questions: NewQuestion[] = [];
  for (const q of rawQuestions) {
    const question = str((q as Body)?.question, 150);
    const answer = str((q as Body)?.answer, 100);
    if (!question && !answer) continue;
    if (!question || !answer) return "Each verification question needs an answer.";
    questions.push({ question, answer });
  }
  if (questions.length < 2 || questions.length > 3) return "Add 2 or 3 verification questions.";
  return { category: b.category, colour: b.colour, locationId: b.locationId, foundDate, description, custody: b.custody, deskId, meetLocationId, questions };
}

// ---------- Persistence ----------

export function createLost(db: Db, ownerId: string, input: NewLost, now = new Date()): LostItem {
  const id = randomUUID();
  const ts = now.toISOString();
  run(
    db,
    `INSERT INTO lost_items (id, owner_id, category, colour, brand, description, location_id, lost_date,
       time_from, time_to, private_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
    id,
    ownerId,
    input.category,
    input.colour,
    input.brand,
    input.description,
    input.locationId,
    input.lostDate,
    input.timeFrom,
    input.timeTo,
    JSON.stringify(input.privateDetails),
    ts,
    ts,
  );
  return getLost(db, id)!;
}

export function createFound(db: Db, finderId: string, input: NewFound, now = new Date()): FoundItem {
  const id = randomUUID();
  const ts = now.toISOString();
  transaction(db, () => {
    run(
      db,
      `INSERT INTO found_items (id, finder_id, category, colour, location_id, found_date, description, custody,
         desk_id, meet_location_id, received_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'open', ?, ?)`,
      id,
      finderId,
      input.category,
      input.colour,
      input.locationId,
      input.foundDate,
      input.description,
      input.custody,
      input.deskId,
      input.meetLocationId,
      ts,
      ts,
    );
    input.questions.forEach((q, position) => {
      const salt = newSalt();
      run(
        db,
        "INSERT INTO questions (id, found_id, position, question, salt, answer_hash) VALUES (?, ?, ?, ?, ?, ?)",
        randomUUID(),
        id,
        position,
        q.question,
        salt,
        hashAnswer(q.answer, salt),
      );
    });
  });
  return getFound(db, id)!;
}

export function getLost(db: Db, id: string): LostItem | undefined {
  const row = one(db, "SELECT * FROM lost_items WHERE id = ?", id);
  return row && toLost(row);
}

export function getFound(db: Db, id: string): FoundItem | undefined {
  const row = one(db, "SELECT * FROM found_items WHERE id = ?", id);
  return row && toFound(row);
}

export function listLostByOwner(db: Db, ownerId: string): LostItem[] {
  return all(db, "SELECT * FROM lost_items WHERE owner_id = ? ORDER BY created_at DESC", ownerId).map(toLost);
}

export function listFoundByFinder(db: Db, finderId: string): FoundItem[] {
  return all(db, "SELECT * FROM found_items WHERE finder_id = ? ORDER BY created_at DESC", finderId).map(toFound);
}

export function listOpenLost(db: Db): LostItem[] {
  return all(db, "SELECT * FROM lost_items WHERE status = 'open' ORDER BY created_at DESC").map(toLost);
}

export function listOpenFound(db: Db): FoundItem[] {
  return all(db, "SELECT * FROM found_items WHERE status = 'open' ORDER BY created_at DESC").map(toFound);
}

export function listQuestions(db: Db, foundId: string) {
  return all(db, "SELECT * FROM questions WHERE found_id = ? ORDER BY position", foundId).map((r) => ({
    id: String(r.id),
    position: Number(r.position),
    question: String(r.question),
    salt: String(r.salt),
    answerHash: String(r.answer_hash),
  }));
}

export function setLostStatus(db: Db, id: string, status: LostStatus, now = new Date()): void {
  run(db, "UPDATE lost_items SET status = ?, updated_at = ? WHERE id = ?", status, now.toISOString(), id);
}

export function setFoundStatus(db: Db, id: string, status: FoundStatus, now = new Date()): void {
  run(db, "UPDATE found_items SET status = ?, updated_at = ? WHERE id = ?", status, now.toISOString(), id);
}

export function markReceived(db: Db, id: string, now = new Date()): void {
  run(db, "UPDATE found_items SET received_at = ?, updated_at = ? WHERE id = ?", now.toISOString(), now.toISOString(), id);
}

/** Closes open reports with no activity since the cutoff. Returns how many were closed. */
export function closeStaleReports(db: Db, olderThanDays: number, now = new Date()): number {
  const cutoff = new Date(now.getTime() - olderThanDays * 86_400_000).toISOString();
  const ts = now.toISOString();
  return (
    run(db, "UPDATE lost_items SET status = 'closed', updated_at = ? WHERE status = 'open' AND updated_at < ?", ts, cutoff) +
    run(db, "UPDATE found_items SET status = 'closed', updated_at = ? WHERE status = 'open' AND updated_at < ?", ts, cutoff)
  );
}
