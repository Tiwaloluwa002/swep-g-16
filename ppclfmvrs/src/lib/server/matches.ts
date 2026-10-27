import { CATEGORIES } from "@/lib/catalog";
import { NOTIFY_THRESHOLD, rankMatches, scoreMatch, SHOW_THRESHOLD } from "@/lib/matching";
import type { Candidate } from "@/lib/public-types";
import type { FoundItem, LostItem } from "@/lib/types";
import { all, type Db, one } from "./db";
import { toFound, toLost } from "./items";
import { notify } from "./notifications";
import { publicFound } from "./serialize";

/** Records a pair and tells both sides, once per pair. */
async function recordMatch(db: Db, lost: LostItem, found: FoundItem, score: number, now: Date): Promise<void> {
  // One atomic upsert; xmax = 0 only on a fresh insert, so two racing requests can't both notify.
  const row = await one(
    db,
    `INSERT INTO {schema}.matches (lost_id, found_id, score, created_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (lost_id, found_id) DO UPDATE SET score = excluded.score
     RETURNING (xmax = 0) AS inserted`,
    lost.id,
    found.id,
    score,
    now.toISOString(),
  );
  if (row?.inserted !== true || score < NOTIFY_THRESHOLD) return;
  const what = `${found.colour} ${CATEGORIES[found.category].toLowerCase()}`;
  await notify(db, lost.ownerId, `A found ${what} may be yours. Review the candidates and claim it.`, `/lost/${lost.id}`, now);
  await notify(
    db,
    found.finderId,
    `The ${what} you found may match a lost report. The owner has been told; they must answer your questions before any handover.`,
    `/found/${found.id}`,
    now,
  );
}

export async function matchNewLost(db: Db, lost: LostItem, now = new Date()): Promise<void> {
  const rows = await all(db, "SELECT * FROM {schema}.found_items WHERE status = 'open' AND category = $1 AND finder_id <> $2", lost.category, lost.ownerId);
  for (const f of rows.map(toFound)) {
    const m = scoreMatch(lost, f);
    if (m && m.score >= SHOW_THRESHOLD) await recordMatch(db, lost, f, m.score, now);
  }
}

export async function matchNewFound(db: Db, found: FoundItem, now = new Date()): Promise<void> {
  const rows = await all(db, "SELECT * FROM {schema}.lost_items WHERE status = 'open' AND category = $1 AND owner_id <> $2", found.category, found.finderId);
  for (const l of rows.map(toLost)) {
    const m = scoreMatch(l, found);
    if (m && m.score >= SHOW_THRESHOLD) await recordMatch(db, l, found, m.score, now);
  }
}

/**
 * Ranked candidates for an owner's lost report, recomputed live so status
 * changes show at once. Items the owner already claimed stay in the list.
 */
export async function candidatesFor(db: Db, lost: LostItem): Promise<Candidate[]> {
  const claims = new Map(
    (await all(db, "SELECT id, found_id FROM {schema}.claims WHERE lost_id = $1", lost.id)).map((r) => [String(r.found_id), String(r.id)]),
  );
  const found = (await all(db, "SELECT * FROM {schema}.found_items WHERE category = $1 AND finder_id <> $2", lost.category, lost.ownerId))
    .map(toFound)
    .filter((f) => f.status === "open" || claims.has(f.id));
  return rankMatches(lost, found).map((m) => ({
    score: m.score,
    breakdown: m.breakdown,
    found: publicFound(m.found),
    claimId: claims.get(m.found.id) ?? null,
  }));
}
