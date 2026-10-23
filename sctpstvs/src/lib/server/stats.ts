import type { Db } from "@/lib/server/db";
import type { AdminStats, FraudKind, RouteStats } from "@/lib/types";

export function adminStats(db: Db, now = Date.now()): AdminStats {
  const one = <T>(sql: string, ...args: (string | number)[]) => db.prepare(sql).get(...args) as T;
  const sales = one<{ n: number; kobo: number }>(
    "SELECT COUNT(*) AS n, COALESCE(SUM(fare_kobo), 0) AS kobo FROM tickets",
  );
  const counts = one<{ redeemed: number; active: number; expired: number }>(
    `SELECT
       SUM(status = 'redeemed') AS redeemed,
       SUM(status = 'active' AND expires_at > ?) AS active,
       SUM(status = 'active' AND expires_at <= ?) AS expired
     FROM tickets`,
    now,
    now,
  );
  const ledger = one<{ topups: number; refunds: number; float: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN kind = 'topup' THEN amount_kobo END), 0) AS topups,
       COALESCE(SUM(CASE WHEN kind = 'refund' THEN amount_kobo END), 0) AS refunds,
       COALESCE(SUM(amount_kobo), 0) AS float
     FROM ledger`,
  );
  const fraud24 = one<{ n: number }>("SELECT COUNT(*) AS n FROM fraud_log WHERE at > ?", now - 24 * 60 * 60_000);
  const fraudByKind = Object.fromEntries(
    (db.prepare("SELECT kind, COUNT(*) AS n FROM fraud_log GROUP BY kind").all() as { kind: FraudKind; n: number }[]).map(
      (r) => [r.kind, r.n],
    ),
  );
  const byRoute = (
    db
      .prepare(
        `SELECT r.id, r.name, COUNT(t.id) AS sold, COALESCE(SUM(t.status = 'redeemed'), 0) AS redeemed,
                COALESCE(SUM(CASE WHEN t.status <> 'refunded' THEN t.fare_kobo END), 0) AS revenue
         FROM routes r LEFT JOIN tickets t ON t.route_id = r.id GROUP BY r.id ORDER BY sold DESC, r.name`,
      )
      .all() as { id: number; name: string; sold: number; redeemed: number; revenue: number }[]
  ).map<RouteStats>((r) => ({
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
    redeemed: counts.redeemed ?? 0,
    active: counts.active ?? 0,
    expiredUnused: counts.expired ?? 0,
    topUpsKobo: ledger.topups,
    walletFloatKobo: ledger.float,
    fraudLast24h: fraud24.n,
    fraudByKind,
    byRoute,
  };
}
