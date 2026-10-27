import { randomUUID } from "node:crypto";
import { CATEGORIES } from "@/lib/catalog";
import { scoreMatch, SHOW_THRESHOLD } from "@/lib/matching";
import type { ClaimView } from "@/lib/public-types";
import type { Claim, ClaimStatus, FoundItem, User } from "@/lib/types";
import { answerMatches, newHandoverCode, normalizeHandoverCode, sha256 } from "./crypto";
import { all, count, type Db, iso, one, type Row, run } from "./db";
import { getFound, getLost, listQuestions, setFoundStatus, setLostStatus, toFound } from "./items";
import { ATTEMPT_WINDOW_MS, checkAttempt, MAX_ATTEMPTS_PER_CLAIM } from "./limits";
import { notify } from "./notifications";
import { handoverInfo, publicFound, publicLost } from "./serialize";

/** How long a handover code stays valid. The owner can ask for a fresh one. */
export const CODE_TTL_MS = 72 * 60 * 60 * 1000;

/** An error with the HTTP status the route should answer with. */
export class ClaimError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toClaim(row: Row): Claim {
  return {
    id: String(row.id),
    lostId: String(row.lost_id),
    foundId: String(row.found_id),
    claimantId: String(row.claimant_id),
    status: row.status as ClaimStatus,
    attempts: Number(row.attempts),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export async function getClaim(db: Db, id: string): Promise<Claim | undefined> {
  const row = await one(db, "SELECT * FROM {schema}.claims WHERE id = $1", id);
  return row && toClaim(row);
}

export async function listClaimsByUser(db: Db, userId: string): Promise<Claim[]> {
  return (await all(db, "SELECT * FROM {schema}.claims WHERE claimant_id = $1 ORDER BY created_at DESC, id", userId)).map(toClaim);
}

const itemLabel = (f: FoundItem) => `${f.colour} ${CATEGORIES[f.category].toLowerCase()}`;

/** The owner of a lost report claims one of its candidates. Idempotent per pair. */
export async function startClaim(db: Db, user: User, lostId: string, foundId: string, now = new Date()): Promise<Claim> {
  const lost = await getLost(db, lostId);
  if (!lost || lost.ownerId !== user.id) throw new ClaimError(404, "Lost report not found.");
  const found = await getFound(db, foundId);
  if (!found) throw new ClaimError(404, "Found item not found.");

  const existing = await one(db, "SELECT * FROM {schema}.claims WHERE lost_id = $1 AND found_id = $2", lostId, foundId);
  if (existing) return toClaim(existing);

  if (lost.status !== "open") throw new ClaimError(409, "This lost report is no longer open.");
  if (found.status !== "open") throw new ClaimError(409, "This item is no longer available to claim.");
  if (found.finderId === user.id) throw new ClaimError(403, "You cannot claim an item you reported finding.");
  // Only items the matcher would show can be claimed, so claims can't be used to probe any item.
  const match = scoreMatch(lost, found);
  if (!match || match.score < SHOW_THRESHOLD) throw new ClaimError(403, "This item does not match your report.");

  const ts = now.toISOString();
  // If two requests race, the unique (lost_id, found_id) pair keeps one claim and both return it.
  await run(
    db,
    `INSERT INTO {schema}.claims (id, lost_id, found_id, claimant_id, status, attempts, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'open', 0, $5, $5)
     ON CONFLICT (lost_id, found_id) DO NOTHING`,
    randomUUID(),
    lostId,
    foundId,
    user.id,
    ts,
  );
  return toClaim((await one(db, "SELECT * FROM {schema}.claims WHERE lost_id = $1 AND found_id = $2", lostId, foundId))!);
}

async function activeCodeExpiry(db: Db, claimId: string): Promise<string | null> {
  const row = await one(
    db,
    "SELECT expires_at FROM {schema}.handover_codes WHERE claim_id = $1 AND used_at IS NULL AND NOT revoked ORDER BY created_at DESC LIMIT 1",
    claimId,
  );
  return row ? iso(row.expires_at) : null;
}

export async function claimView(db: Db, claim: Claim): Promise<ClaimView> {
  const lost = (await getLost(db, claim.lostId))!;
  const found = (await getFound(db, claim.foundId))!;
  const showHandover = claim.status === "verified" || claim.status === "completed";
  return {
    id: claim.id,
    status: claim.status,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS_PER_CLAIM - claim.attempts),
    questions: (await listQuestions(db, found.id)).map((q) => q.question),
    lost: publicLost(lost),
    found: publicFound(found),
    handover: showHandover
      ? { ...handoverInfo(found, "owner"), codeExpiresAt: claim.status === "verified" ? await activeCodeExpiry(db, claim.id) : null }
      : null,
  };
}

/**
 * Revokes any earlier unused code, so only the newest one works. Returns the
 * plain code once. Call it inside a transaction that holds the claim row lock.
 */
export async function issueHandoverCode(db: Db, claimId: string, now = new Date()): Promise<{ code: string; expiresAt: string }> {
  const code = newHandoverCode();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  await run(db, "UPDATE {schema}.handover_codes SET revoked = true WHERE claim_id = $1 AND used_at IS NULL", claimId);
  await run(
    db,
    `INSERT INTO {schema}.handover_codes (id, claim_id, code_hash, expires_at, used_at, used_by, revoked, created_at)
     VALUES ($1, $2, $3, $4, NULL, NULL, false, $5)`,
    randomUUID(),
    claimId,
    sha256(code),
    expiresAt,
    now.toISOString(),
  );
  return { code, expiresAt };
}

export function userAttemptsInWindow(db: Db, userId: string, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - ATTEMPT_WINDOW_MS).toISOString();
  return count(db, "SELECT COUNT(*)::int AS n FROM {schema}.claim_attempts WHERE user_id = $1 AND created_at > $2", userId, since);
}

export type VerifyResult =
  | { outcome: "verified"; code: string; expiresAt: string }
  | { outcome: "wrong"; attemptsLeft: number; locked: boolean };

async function deskStaff(db: Db, deskId: string | null): Promise<string[]> {
  return (await all(db, "SELECT id FROM {schema}.users WHERE role = 'desk' AND desk_id = $1", deskId)).map((r) => String(r.id));
}

/*
 * Concurrency. Postgres runs requests in parallel, so every check-then-write
 * below happens inside one transaction that first locks the rows it depends
 * on. Locks are always taken in the same order (user, found item, claim,
 * handover codes) so two requests can never wait on each other in a cycle.
 */

/**
 * Compares the claimant's answers with the finder's hashed answers. All
 * answers must be right. Every attempt is logged; wrong ones count towards
 * the per-claim and per-day limits.
 *
 * The user row lock serialises one user's attempts (the daily cap spans all
 * their claims), the found item lock stops two owners winning the same item,
 * and the claim row lock (FOR UPDATE) guards its attempt counter. Counting
 * and recording happen under those locks, so parallel wrong answers cannot
 * exceed either limit.
 */
export async function verifyClaim(db: Db, user: User, claimId: string, answers: unknown, now = new Date()): Promise<VerifyResult> {
  const unlocked = await getClaim(db, claimId);
  if (!unlocked || unlocked.claimantId !== user.id) throw new ClaimError(404, "Claim not found.");
  const ts = now.toISOString();

  return db.transaction(async (tx) => {
    await run(tx, "SELECT id FROM {schema}.users WHERE id = $1 FOR NO KEY UPDATE", user.id);
    const found = toFound((await one(tx, "SELECT * FROM {schema}.found_items WHERE id = $1 FOR NO KEY UPDATE", unlocked.foundId))!);
    const claim = toClaim((await one(tx, "SELECT * FROM {schema}.claims WHERE id = $1 FOR UPDATE", claimId))!);

    if (claim.status === "verified" || claim.status === "completed") throw new ClaimError(409, "This claim is already verified.");
    if (claim.status === "cancelled") throw new ClaimError(409, "This item has been returned to someone else.");

    const limit = checkAttempt(claim.attempts, await userAttemptsInWindow(tx, user.id, now));
    if (!limit.ok) throw new ClaimError(429, limit.message);

    if (found.status !== "open") throw new ClaimError(409, "This item is no longer available to claim.");

    const questions = await listQuestions(tx, found.id);
    if (!Array.isArray(answers) || answers.length !== questions.length || answers.some((a) => typeof a !== "string")) {
      throw new ClaimError(400, "Answer every question.");
    }
    // Check every answer, not just until the first wrong one, so timing says nothing about which was wrong.
    const results = await Promise.all(questions.map((q, i) => answerMatches(answers[i] as string, q.salt, q.answerHash)));
    const success = results.every(Boolean);

    await run(
      tx,
      "INSERT INTO {schema}.claim_attempts (id, claim_id, user_id, success, created_at) VALUES ($1, $2, $3, $4, $5)",
      randomUUID(),
      claim.id,
      user.id,
      success,
      ts,
    );

    if (!success) {
      const attempts = claim.attempts + 1;
      const locked = attempts >= MAX_ATTEMPTS_PER_CLAIM;
      await run(tx, "UPDATE {schema}.claims SET attempts = $1, status = $2, updated_at = $3 WHERE id = $4", attempts, locked ? "locked" : "open", ts, claim.id);
      return { outcome: "wrong", attemptsLeft: MAX_ATTEMPTS_PER_CLAIM - attempts, locked } as const;
    }

    await run(tx, "UPDATE {schema}.claims SET status = 'verified', updated_at = $1 WHERE id = $2", ts, claim.id);
    await setFoundStatus(tx, found.id, "pending_handover", now);
    // Other claimants on this item can no longer win it.
    const others = await all(
      tx,
      "UPDATE {schema}.claims SET status = 'cancelled', updated_at = $1 WHERE found_id = $2 AND id <> $3 AND status = 'open' RETURNING id, claimant_id",
      ts,
      found.id,
      claim.id,
    );
    for (const other of others) {
      await notify(tx, String(other.claimant_id), `The ${itemLabel(found)} you claimed has been verified for someone else.`, `/claims/${other.id}`, now);
    }
    const message = `An owner proved ownership of the ${itemLabel(found)}. Handover: ${handoverInfo(found, "finder").place}.`;
    await notify(tx, found.finderId, message, `/found/${found.id}`, now);
    if (found.custody === "desk") for (const id of await deskStaff(tx, found.deskId)) await notify(tx, id, message, "/desk", now);
    await notify(tx, user.id, `Ownership verified for the ${itemLabel(found)}. Show your handover code to collect it.`, `/claims/${claim.id}`, now);

    return { outcome: "verified", ...(await issueHandoverCode(tx, claim.id, now)) } as const;
  });
}

/** The verified owner asks for a fresh code (lost or expired). The old one stops working. */
export async function reissueCode(db: Db, user: User, claimId: string, now = new Date()): Promise<{ code: string; expiresAt: string }> {
  return db.transaction(async (tx) => {
    const row = await one(tx, "SELECT * FROM {schema}.claims WHERE id = $1 FOR UPDATE", claimId);
    const claim = row && toClaim(row);
    if (!claim || claim.claimantId !== user.id) throw new ClaimError(404, "Claim not found.");
    if (claim.status !== "verified") throw new ClaimError(409, "Only a verified claim waiting for handover has a code.");
    return issueHandoverCode(tx, claim.id, now);
  });
}

/** Who may accept a code: the item's desk (or any admin), or the finder for items they hold. */
function canConfirm(actor: User, found: FoundItem): boolean {
  if (actor.role === "admin") return true;
  if (found.custody === "desk") return actor.role === "desk" && actor.deskId === found.deskId;
  return actor.id === found.finderId;
}

export type HandoverResult = { claimId: string; item: string; foundId: string };

/**
 * Accepts a handover code once, then marks the item recovered.
 *
 * Single use rests on one conditional UPDATE … WHERE used_at IS NULL AND NOT
 * revoked AND expires_at > now RETURNING. If two requests race, Postgres makes
 * the second wait for the first's row lock and then re-checks the WHERE clause
 * against the committed row, which by then has used_at set, so it updates
 * nothing. "now" is the app's clock (a parameter) so tests can fix time.
 */
export async function confirmHandover(db: Db, actor: User, codeInput: string, now = new Date()): Promise<HandoverResult> {
  const code = normalizeHandoverCode(codeInput);
  const row = await one(
    db,
    "SELECT h.id, h.claim_id, c.found_id FROM {schema}.handover_codes h JOIN {schema}.claims c ON c.id = h.claim_id WHERE h.code_hash = $1",
    sha256(code),
  );
  if (!row) throw new ClaimError(404, "Code not recognised. Check it and try again.");
  const codeId = String(row.id);
  const claimId = String(row.claim_id);
  // Custody, desk and finder never change after the report is made, so this check needs no lock.
  const found = (await getFound(db, String(row.found_id)))!;
  if (!canConfirm(actor, found)) throw new ClaimError(403, "This code is for an item you are not holding.");

  const ts = now.toISOString();
  return db.transaction(async (tx) => {
    // Same lock order as verifyClaim and reissueCode: found item, claim, then the code.
    await run(tx, "SELECT id FROM {schema}.found_items WHERE id = $1 FOR NO KEY UPDATE", found.id);
    const claim = toClaim((await one(tx, "SELECT * FROM {schema}.claims WHERE id = $1 FOR UPDATE", claimId))!);
    const used = await one(
      tx,
      `UPDATE {schema}.handover_codes SET used_at = $1, used_by = $2
       WHERE id = $3 AND used_at IS NULL AND NOT revoked AND expires_at > $1
       RETURNING id`,
      ts,
      actor.id,
      codeId,
    );
    if (!used) {
      const current = (await one(tx, "SELECT used_at, revoked FROM {schema}.handover_codes WHERE id = $1", codeId))!;
      if (current.used_at) throw new ClaimError(409, "This code has already been used.");
      if (current.revoked === true) throw new ClaimError(410, "This code was replaced by a newer one. Ask the owner for their latest code.");
      throw new ClaimError(410, "This code has expired. The owner can get a new one from their claim page.");
    }
    await run(tx, "UPDATE {schema}.claims SET status = 'completed', updated_at = $1 WHERE id = $2", ts, claim.id);
    await setFoundStatus(tx, found.id, "recovered", now);
    await setLostStatus(tx, claim.lostId, "recovered", now);
    await notify(tx, claim.claimantId, `Handover confirmed. Your ${itemLabel(found)} is marked as recovered.`, `/claims/${claim.id}`, now);
    if (actor.id !== found.finderId) {
      await notify(tx, found.finderId, `The ${itemLabel(found)} you found has been returned to its owner. Thank you!`, `/found/${found.id}`, now);
    }
    return { claimId: claim.id, item: itemLabel(found), foundId: found.id };
  });
}
