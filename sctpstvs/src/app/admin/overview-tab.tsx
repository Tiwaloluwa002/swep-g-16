"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { FRAUD_LABELS } from "@/lib/labels";
import { formatNaira } from "@/lib/money";
import type { AdminStats, FraudKind } from "@/lib/types";
import { ErrorText, Stat, TableBox } from "./ui";

export function OverviewTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<AdminStats>("/api/admin/stats")
      .then(setStats)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (!stats) return error ? <ErrorText message={error} /> : <p role="status">Loading…</p>;
  const fraud = Object.entries(stats.fraudByKind) as [FraudKind, number][];

  return (
    <>
      <section aria-labelledby="sales-heading" className="flex flex-col gap-2">
        <h2 id="sales-heading" className="text-lg font-bold">
          Sales and redemptions
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Tickets sold" value={stats.ticketsSold} />
          <Stat label="Ticket sales" value={formatNaira(stats.salesKobo)} hint={`Refunded ${formatNaira(stats.refundsKobo)}`} />
          <Stat label="Used (redeemed)" value={stats.redeemed} />
          <Stat label="Active now" value={stats.active} />
          <Stat label="Expired unused" value={stats.expiredUnused} />
          <Stat label="Wallet top-ups" value={formatNaira(stats.topUpsKobo)} hint="Demo credit, not real money" />
          <Stat label="Held in wallets" value={formatNaira(stats.walletFloatKobo)} />
          <Stat label="Fraud events (24 h)" value={stats.fraudLast24h} />
        </dl>
      </section>

      <section aria-labelledby="route-heading" className="flex flex-col gap-2">
        <h2 id="route-heading" className="text-lg font-bold">
          By route
        </h2>
        <TableBox label="Sales by route">
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col" className="text-right">Sold</th>
              <th scope="col" className="text-right">Used</th>
              <th scope="col" className="text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {stats.byRoute.map((r) => (
              <tr key={r.routeId}>
                <td>{r.routeName}</td>
                <td className="text-right tabular-nums">{r.sold}</td>
                <td className="text-right tabular-nums">{r.redeemed}</td>
                <td className="text-right tabular-nums">{formatNaira(r.revenueKobo)}</td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      </section>

      <section aria-labelledby="fraud-summary-heading" className="flex flex-col gap-2">
        <h2 id="fraud-summary-heading" className="text-lg font-bold">
          Fraud events by type (all time)
        </h2>
        {fraud.length === 0 ? (
          <p className="text-muted">None recorded.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {fraud.map(([kind, n]) => (
              <li key={kind} className="rounded-full border border-border bg-surface px-3 py-1 text-sm">
                {FRAUD_LABELS[kind]}: <strong>{n}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
