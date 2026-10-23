import { CATEGORIES } from "@/lib/catalog";
import { NOTIFY_THRESHOLD, rankMatches, scoreMatch, SHOW_THRESHOLD } from "@/lib/matching";
import type { Candidate } from "@/lib/public-types";
import type { FoundItem, LostItem } from "@/lib/types";
import { all, type Db, one, run } from "./db";
import { toFound, toLost } from "./items";
import { notify } from "./notifications";
import { publicFound } from "./serialize";

/** Records a pair and tells both sides, once per pair. */
function recordMatch(db: Db, lost: LostItem, found: FoundItem, score: number, now: Date): void {
  const isNew = !one(db, "SELECT 1 FROM matches WHERE lost_id = ? AND found_id = ?", lost.id, found.id);
  run(
    db,
    `INSERT INTO matches (lost_id, found_id, score, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (lost_id, found_id) DO UPDATE SET score = excluded.score`,
    lost.id,
    found.id,
    score,
    now.toISOString(),
  );
  if (!isNew || score < NOTIFY_THRESHOLD) return;
  const what = `${found.colour} ${CATEGORIES[found.category].toLowerCase()}`;
  notify(db, lost.ownerId, `A found ${what} may be yours. Review the candidates and claim it.`, `/lost/${lost.id}`, now);
  notify(
    db,
    found.finderId,
    `The ${what} you found may match a lost report. The owner has been told; they must answer your questions before any handover.`,
    `/found/${found.id}`,
    now,
  );
}

export function matchNewLost(db: Db, lost: LostItem, now = new Date()): void {
  const found = all(db, "SELECT * FROM found_items WHERE status = 'open' AND category = ? AND finder_id != ?", lost.category, lost.ownerId).map(toFound);
  for (const f of found) {
    const m = scoreMatch(lost, f);
    if (m && m.score >= SHOW_THRESHOLD) recordMatch(db, lost, f, m.score, now);
  }
}

export function matchNewFound(db: Db, found: FoundItem, now = new Date()): void {
  const lost = all(db, "SELECT * FROM lost_items WHERE status = 'open' AND category = ? AND owner_id != ?", found.category, found.finderId).map(toLost);
  for (const l of lost) {
    const m = scoreMatch(l, found);
    if (m && m.score >= SHOW_THRESHOLD) recordMatch(db, l, found, m.score, now);
  }
}

/**
 * Ranked candidates for an owner's lost report, recomputed live so status
 * changes show at once. Items the owner already claimed stay in the list.
 */
export function candidatesFor(db: Db, lost: LostItem): Candidate[] {
  const claims = new Map(
    all(db, "SELECT id, found_id FROM claims WHERE lost_id = ?", lost.id).map((r) => [String(r.found_id), String(r.id)]),
  );
  const found = all(db, "SELECT * FROM found_items WHERE category = ? AND finder_id != ?", lost.category, lost.ownerId)
    .map(toFound)
    .filter((f) => f.status === "open" || claims.has(f.id));
  return rankMatches(lost, found).map((m) => ({
    score: m.score,
    breakdown: m.breakdown,
    found: publicFound(m.found),
    claimId: claims.get(m.found.id) ?? null,
  }));
}
