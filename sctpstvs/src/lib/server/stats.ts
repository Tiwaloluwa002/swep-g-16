import { type Db, ts } from "@/lib/server/db";
import type { AdminStats, FraudKind, RouteStats } from "@/lib/types";

export async function adminStats(db: Db, now = Date.now()): Promise<AdminStats> {
  const [sales, counts, ledger, fraud24, fraudRows, routeRows] = await Promise.all([
    db.one<{ n: number; kobo: number }>(
      "SELECT COUNT(*) AS n, COALESCE(SUM(fare_kobo), 0)::bigint AS kobo FROM {schema}.tickets",
    ),
    db.one<{ redeemed: number; active: number; expired: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'redeemed') AS redeemed,
         COUNT(*) FILTER (WHERE status = 'active' AND expires_at > $1) AS active,
         COUNT(*) FILTER (WHERE status = 'active' AND expires_at <= $1) AS expired
       FROM {schema}.tickets`,
      [ts(now)],
    ),
    db.one<{ topups: number; refunds: number; float: number }>(
      `SELECT
         COALESCE(SUM(amount_kobo) FILTER (WHERE kind = 'topup'), 0)::bigint AS topups,
         COALESCE(SUM(amount_kobo) FILTER (WHERE kind = 'refund'), 0)::bigint AS refunds,
         COALESCE(SUM(amount_kobo), 0)::bigint AS float
       FROM {schema}.ledger`,
    ),
    db.one<{ n: number }>("SELECT COUNT(*) AS n FROM {schema}.fraud_log WHERE at > $1", [ts(now - 24 * 60 * 60_000)]),
    db.query<{ kind: FraudKind; n: number }>("SELECT kind, COUNT(*) AS n FROM {schema}.fraud_log GROUP BY kind"),
    db.query<{ id: number; name: string; sold: number; redeemed: number; revenue: number }>(
      `SELECT r.id, r.name, COUNT(t.id) AS sold,
              COUNT(t.id) FILTER (WHERE t.status = 'redeemed') AS redeemed,
              COALESCE(SUM(t.fare_kobo) FILTER (WHERE t.status <> 'refunded'), 0)::bigint AS revenue
       FROM {schema}.routes r LEFT JOIN {schema}.tickets t ON t.route_id = r.id
       GROUP BY r.id ORDER BY sold DESC, r.name`,
    ),
  ]);
  const byRoute = routeRows.map<RouteStats>((r) => ({
    routeId: r.id,
    routeName: r.name,
    sold: r.sold,
    redeemed: r.redeemed,
    revenueKobo: r.revenue,
  }));
  return {
    ticketsSold: sales.n,
    salesKobo: sales.kobo,
    refundsKobo: ledger.refunds,
    redeemed: counts.redeemed,
    active: counts.active,
    expiredUnused: counts.expired,
    topUpsKobo: ledger.topups,
    walletFloatKobo: ledger.float,
    fraudLast24h: fraud24.n,
    fraudByKind: Object.fromEntries(fraudRows.map((r) => [r.kind, r.n])),
    byRoute,
  };
}
