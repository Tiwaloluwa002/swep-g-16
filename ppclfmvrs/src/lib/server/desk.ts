import { CATEGORIES, getDesk } from "@/lib/catalog";
import type { DeskItem, FailedAttempt, Stats } from "@/lib/public-types";
import type { User } from "@/lib/types";
import { all, type Db, one } from "./db";
import { toFound } from "./items";
import { publicFound } from "./serialize";

/** Desk officers see their own desk; admins see every desk. */
function deskFilter(user: User): [string, (string | null)[]] {
  return user.role === "admin" ? ["", []] : [" AND f.desk_id = ?", [user.deskId]];
}

/** Items handed (or due to be handed) to a desk and not yet recovered or closed. */
export function listDeskItems(db: Db, user: User): DeskItem[] {
  const [where, params] = deskFilter(user);
  const rows = all(
    db,
    `SELECT f.*, (
       SELECT h.expires_at FROM claims c JOIN handover_codes h ON h.claim_id = c.id
       WHERE c.found_id = f.id AND c.status = 'verified' AND h.used_at IS NULL AND h.revoked = 0
       ORDER BY h.created_at DESC LIMIT 1
     ) AS code_expires
     FROM found_items f
     WHERE f.custody = 'desk' AND f.status IN ('open', 'pending_handover')${where}
     ORDER BY f.created_at DESC`,
    ...params,
  );
  return rows.map((row) => {
    const item = toFound(row);
    return {
      ...publicFound(item),
      deskName: getDesk(item.deskId)?.name ?? null,
      receivedAt: item.receivedAt,
      awaitingCollectionUntil: (row.code_expires as string | null) ?? null,
    };
  });
}

/** Wrong-answer attempts, newest first. Staff see the claimant's ident so repeat fishing can be followed up. */
export function listFailedAttempts(db: Db, user: User, limit = 50): FailedAttempt[] {
  const [where, params] = deskFilter(user);
  return all(
    db,
    `SELECT a.id, a.created_at, a.claim_id, u.ident, c.status AS claim_status, f.category, f.colour
     FROM claim_attempts a
     JOIN claims c ON c.id = a.claim_id
     JOIN users u ON u.id = a.user_id
     JOIN found_items f ON f.id = c.found_id
     WHERE a.success = 0${where}
     ORDER BY a.created_at DESC LIMIT ?`,
    ...params,
    limit,
  ).map((r) => ({
    id: String(r.id),
    createdAt: String(r.created_at),
    claimantIdent: String(r.ident),
    claimId: String(r.claim_id),
    itemSummary: `${r.colour} ${CATEGORIES[r.category as keyof typeof CATEGORIES]?.toLowerCase() ?? r.category}`,
    claimLocked: r.claim_status === "locked",
  }));
}

export function getStats(db: Db): Stats {
  const n = (sql: string) => Number(one(db, sql)!.n);
  return {
    lostReported: n("SELECT COUNT(*) AS n FROM lost_items"),
    foundReported: n("SELECT COUNT(*) AS n FROM found_items"),
    matched: n("SELECT COUNT(DISTINCT found_id) AS n FROM matches"),
    verified: n("SELECT COUNT(*) AS n FROM claims WHERE status IN ('verified', 'completed')"),
    recovered: n("SELECT COUNT(*) AS n FROM found_items WHERE status = 'recovered'"),
    failedAttempts: n("SELECT COUNT(*) AS n FROM claim_attempts WHERE success = 0"),
  };
}
