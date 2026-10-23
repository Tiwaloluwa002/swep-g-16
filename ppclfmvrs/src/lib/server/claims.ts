import { randomUUID } from "node:crypto";
import { CATEGORIES } from "@/lib/catalog";
import { scoreMatch, SHOW_THRESHOLD } from "@/lib/matching";
import type { ClaimView } from "@/lib/public-types";
import type { Claim, ClaimStatus, FoundItem, User } from "@/lib/types";
import { answerMatches, newHandoverCode, normalizeHandoverCode, sha256 } from "./crypto";
import { all, type Db, one, type Row, run, transaction } from "./db";
import { getFound, getLost, listQuestions, setFoundStatus, setLostStatus } from "./items";
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
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function getClaim(db: Db, id: string): Claim | undefined {
  const row = one(db, "SELECT * FROM claims WHERE id = ?", id);
  return row && toClaim(row);
}

export function listClaimsByUser(db: Db, userId: string): Claim[] {
  return all(db, "SELECT * FROM claims WHERE claimant_id = ? ORDER BY created_at DESC", userId).map(toClaim);
}

const itemLabel = (f: FoundItem) => `${f.colour} ${CATEGORIES[f.category].toLowerCase()}`;

/** The owner of a lost report claims one of its candidates. Idempotent per pair. */
export function startClaim(db: Db, user: User, lostId: string, foundId: string, now = new Date()): Claim {
  const lost = getLost(db, lostId);
  if (!lost || lost.ownerId !== user.id) throw new ClaimError(404, "Lost report not found.");
  const found = getFound(db, foundId);
  if (!found) throw new ClaimError(404, "Found item not found.");

  const existing = one(db, "SELECT * FROM claims WHERE lost_id = ? AND found_id = ?", lostId, foundId);
  if (existing) return toClaim(existing);

  if (lost.status !== "open") throw new ClaimError(409, "This lost report is no longer open.");
  if (found.status !== "open") throw new ClaimError(409, "This item is no longer available to claim.");
  if (found.finderId === user.id) throw new ClaimError(403, "You cannot claim an item you reported finding.");
  // Only items the matcher would show can be claimed, so claims can't be used to probe any item.
  const match = scoreMatch(lost, found);
  if (!match || match.score < SHOW_THRESHOLD) throw new ClaimError(403, "This item does not match your report.");

  const id = randomUUID();
  const ts = now.toISOString();
  run(
    db,
    `INSERT INTO claims (id, lost_id, found_id, claimant_id, status, attempts, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'open', 0, ?, ?)`,
    id,
    lostId,
    foundId,
    user.id,
    ts,
    ts,
  );
  return getClaim(db, id)!;
}

function activeCodeExpiry(db: Db, claimId: string): string | null {
  const row = one(
    db,
    "SELECT expires_at FROM handover_codes WHERE claim_id = ? AND used_at IS NULL AND revoked = 0 ORDER BY created_at DESC LIMIT 1",
    claimId,
  );
  return row ? String(row.expires_at) : null;
}

export function claimView(db: Db, claim: Claim): ClaimView {
  const lost = getLost(db, claim.lostId)!;
  const found = getFound(db, claim.foundId)!;
  const showHandover = claim.status === "verified" || claim.status === "completed";
  return {
    id: claim.id,
    status: claim.status,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS_PER_CLAIM - claim.attempts),
    questions: listQuestions(db, found.id).map((q) => q.question),
    lost: publicLost(lost),
    found: publicFound(found),
    handover: showHandover
      ? { ...handoverInfo(found, "owner"), codeExpiresAt: claim.status === "verified" ? activeCodeExpiry(db, claim.id) : null }
      : null,
  };
}

/** Revokes any earlier unused code, so only the newest one works. Returns the plain code once. */
export function issueHandoverCode(db: Db, claimId: string, now = new Date()): { code: string; expiresAt: string } {
  const code = newHandoverCode();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  run(db, "UPDATE handover_codes SET revoked = 1 WHERE claim_id = ? AND used_at IS NULL", claimId);
  run(
    db,
    `INSERT INTO handover_codes (id, claim_id, code_hash, expires_at, used_at, used_by, revoked, created_at)
     VALUES (?, ?, ?, ?, NULL, NULL, 0, ?)`,
    randomUUID(),
    claimId,
    sha256(code),
    expiresAt,
    now.toISOString(),
  );
  return { code, expiresAt };
}

export function userAttemptsInWindow(db: Db, userId: string, now = new Date()): number {
  const since = new Date(now.getTime() - ATTEMPT_WINDOW_MS).toISOString();
  return Number(one(db, "SELECT COUNT(*) AS n FROM claim_attempts WHERE user_id = ? AND created_at > ?", userId, since)!.n);
}

export type VerifyResult =
  | { outcome: "verified"; code: string; expiresAt: string }
  | { outcome: "wrong"; attemptsLeft: number; locked: boolean };

function deskStaff(db: Db, deskId: string | null): string[] {
  return all(db, "SELECT id FROM users WHERE role = 'desk' AND desk_id = ?", deskId).map((r) => String(r.id));
}

/**
 * Compares the claimant's answers with the finder's hashed answers. All
 * answers must be right. Every attempt is logged; wrong ones count towards
 * the per-claim and per-day limits.
 */
export function verifyClaim(db: Db, user: User, claimId: string, answers: unknown, now = new Date()): VerifyResult {
  const claim = getClaim(db, claimId);
  if (!claim || claim.claimantId !== user.id) throw new ClaimError(404, "Claim not found.");
  if (claim.status === "verified" || claim.status === "completed") throw new ClaimError(409, "This claim is already verified.");
  if (claim.status === "cancelled") throw new ClaimError(409, "This item has been returned to someone else.");

  const limit = checkAttempt(claim.attempts, userAttemptsInWindow(db, user.id, now));
  if (!limit.ok) throw new ClaimError(429, limit.message);

  const found = getFound(db, claim.foundId)!;
  if (found.status !== "open") throw new ClaimError(409, "This item is no longer available to claim.");

  const questions = listQuestions(db, found.id);
  if (!Array.isArray(answers) || answers.length !== questions.length || answers.some((a) => typeof a !== "string")) {
    throw new ClaimError(400, "Answer every question.");
  }
  // Check every answer, not just until the first wrong one, so timing says nothing about which was wrong.
  const results = questions.map((q, i) => answerMatches(answers[i] as string, q.salt, q.answerHash));
  const success = results.every(Boolean);
  const ts = now.toISOString();

  return transaction(db, () => {
    run(
      db,
      "INSERT INTO claim_attempts (id, claim_id, user_id, success, created_at) VALUES (?, ?, ?, ?, ?)",
      randomUUID(),
      claim.id,
      user.id,
      success ? 1 : 0,
      ts,
    );

    if (!success) {
      const attempts = claim.attempts + 1;
      const locked = attempts >= MAX_ATTEMPTS_PER_CLAIM;
      run(db, "UPDATE claims SET attempts = ?, status = ?, updated_at = ? WHERE id = ?", attempts, locked ? "locked" : "open", ts, claim.id);
      return { outcome: "wrong", attemptsLeft: MAX_ATTEMPTS_PER_CLAIM - attempts, locked } as const;
    }

    run(db, "UPDATE claims SET status = 'verified', updated_at = ? WHERE id = ?", ts, claim.id);
    setFoundStatus(db, found.id, "pending_handover", now);
    // Other claimants on this item can no longer win it.
    for (const other of all(db, "SELECT * FROM claims WHERE found_id = ? AND id != ? AND status = 'open'", found.id, claim.id)) {
      run(db, "UPDATE claims SET status = 'cancelled', updated_at = ? WHERE id = ?", ts, String(other.id));
      notify(db, String(other.claimant_id), `The ${itemLabel(found)} you claimed has been verified for someone else.`, `/claims/${other.id}`, now);
    }
    const message = `An owner proved ownership of the ${itemLabel(found)}. Handover: ${handoverInfo(found, "finder").place}.`;
    notify(db, found.finderId, message, `/found/${found.id}`, now);
    if (found.custody === "desk") for (const id of deskStaff(db, found.deskId)) notify(db, id, message, "/desk", now);
    notify(db, user.id, `Ownership verified for the ${itemLabel(found)}. Show your handover code to collect it.`, `/claims/${claim.id}`, now);

    return { outcome: "verified", ...issueHandoverCode(db, claim.id, now) } as const;
  });
}

/** The verified owner asks for a fresh code (lost or expired). The old one stops working. */
export function reissueCode(db: Db, user: User, claimId: string, now = new Date()) {
  const claim = getClaim(db, claimId);
  if (!claim || claim.claimantId !== user.id) throw new ClaimError(404, "Claim not found.");
  if (claim.status !== "verified") throw new ClaimError(409, "Only a verified claim waiting for handover has a code.");
  return issueHandoverCode(db, claim.id, now);
}

/** Who may accept a code: the item's desk (or any admin), or the finder for items they hold. */
function canConfirm(actor: User, found: FoundItem): boolean {
  if (actor.role === "admin") return true;
  if (found.custody === "desk") return actor.role === "desk" && actor.deskId === found.deskId;
  return actor.id === found.finderId;
}

export type HandoverResult = { claimId: string; item: string; foundId: string };

/** Accepts a handover code once, then marks the item recovered. */
export function confirmHandover(db: Db, actor: User, codeInput: string, now = new Date()): HandoverResult {
  const code = normalizeHandoverCode(codeInput);
  const row = one(db, "SELECT * FROM handover_codes WHERE code_hash = ?", sha256(code));
  if (!row) throw new ClaimError(404, "Code not recognised. Check it and try again.");
  const claim = getClaim(db, String(row.claim_id))!;
  const found = getFound(db, claim.foundId)!;
  if (!canConfirm(actor, found)) throw new ClaimError(403, "This code is for an item you are not holding.");
  if (row.used_at) throw new ClaimError(409, "This code has already been used.");
  if (Number(row.revoked) === 1) throw new ClaimError(410, "This code was replaced by a newer one. Ask the owner for their latest code.");
  if (String(row.expires_at) <= now.toISOString()) {
    throw new ClaimError(410, "This code has expired. The owner can get a new one from their claim page.");
  }

  const ts = now.toISOString();
  return transaction(db, () => {
    // The used_at guard makes the code single-use even if two requests race.
    const changed = run(db, "UPDATE handover_codes SET used_at = ?, used_by = ? WHERE id = ? AND used_at IS NULL", ts, actor.id, String(row.id));
    if (changed !== 1) throw new ClaimError(409, "This code has already been used.");
    run(db, "UPDATE claims SET status = 'completed', updated_at = ? WHERE id = ?", ts, claim.id);
    setFoundStatus(db, found.id, "recovered", now);
    setLostStatus(db, claim.lostId, "recovered", now);
    notify(db, claim.claimantId, `Handover confirmed. Your ${itemLabel(found)} is marked as recovered.`, `/claims/${claim.id}`, now);
    if (actor.id !== found.finderId) {
      notify(db, found.finderId, `The ${itemLabel(found)} you found has been returned to its owner. Thank you!`, `/found/${found.id}`, now);
    }
    return { claimId: claim.id, item: itemLabel(found), foundId: found.id };
  });
}
