import { CATEGORIES, getDesk } from "@/lib/catalog";
import type { DeskItem, FailedAttempt, Stats } from "@/lib/public-types";
import type { User } from "@/lib/types";
import { all, count, type Db, iso, isoOrNull, type Param } from "./db";
import { toFound } from "./items";
import { publicFound } from "./serialize";

/** Desk officers see their own desk; admins see every desk. Returns an extra WHERE clause and its parameters. */
function deskFilter(user: User): [string, Param[]] {
  return user.role === "admin" ? ["", []] : [" AND f.desk_id = $1", [user.deskId]];
}

/** Items handed (or due to be handed) to a desk and not yet recovered or closed. */
export async function listDeskItems(db: Db, user: User): Promise<DeskItem[]> {
  const [where, params] = deskFilter(user);
  const rows = await all(
    db,
    `SELECT f.*, (
       SELECT h.expires_at FROM {schema}.claims c JOIN {schema}.handover_codes h ON h.claim_id = c.id
       WHERE c.found_id = f.id AND c.status = 'verified' AND h.used_at IS NULL AND NOT h.revoked
       ORDER BY h.created_at DESC LIMIT 1
     ) AS code_expires
     FROM {schema}.found_items f
     WHERE f.custody = 'desk' AND f.status IN ('open', 'pending_handover')${where}
     ORDER BY f.created_at DESC, f.id`,
    ...params,
  );
  return rows.map((row) => {
    const item = toFound(row);
    return {
      ...publicFound(item),
      deskName: getDesk(item.deskId)?.name ?? null,
      receivedAt: item.receivedAt,
      awaitingCollectionUntil: isoOrNull(row.code_expires),
    };
  });
}

/** Wrong-answer attempts, newest first. Staff see the claimant's ident so repeat fishing can be followed up. */
export async function listFailedAttempts(db: Db, user: User, limit = 50): Promise<FailedAttempt[]> {
  const [where, params] = deskFilter(user);
  const rows = await all(
    db,
    `SELECT a.id, a.created_at, a.claim_id, u.ident, c.status AS claim_status, f.category, f.colour
     FROM {schema}.claim_attempts a
     JOIN {schema}.claims c ON c.id = a.claim_id
     JOIN {schema}.users u ON u.id = a.user_id
     JOIN {schema}.found_items f ON f.id = c.found_id
     WHERE NOT a.success${where}
     ORDER BY a.created_at DESC, a.id LIMIT $${params.length + 1}`,
    ...params,
    limit,
  );
  return rows.map((r) => ({
    id: String(r.id),
    createdAt: iso(r.created_at),
    claimantIdent: String(r.ident),
    claimId: String(r.claim_id),
    itemSummary: `${r.colour} ${CATEGORIES[r.category as keyof typeof CATEGORIES]?.toLowerCase() ?? r.category}`,
    claimLocked: r.claim_status === "locked",
  }));
}

export async function getStats(db: Db): Promise<Stats> {
  const n = (sql: string) => count(db, sql);
  const [lostReported, foundReported, matched, verified, recovered, failedAttempts] = await Promise.all([
    n("SELECT COUNT(*)::int AS n FROM {schema}.lost_items"),
    n("SELECT COUNT(*)::int AS n FROM {schema}.found_items"),
    n("SELECT COUNT(DISTINCT found_id)::int AS n FROM {schema}.matches"),
    n("SELECT COUNT(*)::int AS n FROM {schema}.claims WHERE status IN ('verified', 'completed')"),
    n("SELECT COUNT(*)::int AS n FROM {schema}.found_items WHERE status = 'recovered'"),
    n("SELECT COUNT(*)::int AS n FROM {schema}.claim_attempts WHERE NOT success"),
  ]);
  return { lostReported, foundReported, matched, verified, recovered, failedAttempts };
}
