"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { liveStatus } from "@/lib/client/ticket-status";
import { useNow } from "@/lib/client/use-now";
import { formatNaira } from "@/lib/money";
import { formatDateTime, formatDuration, formatTime } from "@/lib/time";
import type { OwnTicket, TicketStatus } from "@/lib/types";

const TABS: { id: string; label: string; statuses: TicketStatus[] }[] = [
  { id: "active", label: "Active", statuses: ["active"] },
  { id: "used", label: "Used", statuses: ["redeemed"] },
  { id: "expired", label: "Expired / refunded", statuses: ["expired", "refunded"] },
];

export function TicketList({ tickets, onShow }: { tickets: OwnTicket[]; onShow: (t: OwnTicket) => void }) {
  const now = useNow();
  const [tab, setTab] = useState("active");
  const withStatus = tickets.map((t) => ({ ...t, status: liveStatus(t, now) }));
  const current = TABS.find((t) => t.id === tab)!;
  const shown = withStatus.filter((t) => current.statuses.includes(t.status));

  return (
    <section aria-labelledby="tickets-heading" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="tickets-heading" className="text-lg font-bold">
        My tickets
      </h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show tickets">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-fg"
          >
            {t.label} ({withStatus.filter((x) => t.statuses.includes(x.status)).length})
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-muted">{tab === "active" ? "No active tickets. Buy one to ride." : "Nothing here yet."}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">{t.routeName}</h3>
                <StatusBadge status={t.status} />
              </div>
              <p className="text-sm text-muted">
                {formatNaira(t.fareKobo)} · bought {formatDateTime(t.issuedAt)} · code{" "}
                <span className="font-mono text-fg">{t.shortCode}</span>
              </p>
              {t.status === "active" && (
                <>
                  <p className="text-sm">
                    Valid until <strong>{formatTime(t.expiresAt)}</strong>
                    {now > 0 && <> ({formatDuration(t.expiresAt - now)} left)</>}
                  </p>
                  <button
                    type="button"
                    onClick={() => onShow(t)}
                    className="self-start rounded-md bg-primary px-4 py-2.5 font-bold text-primary-fg"
                  >
                    Show ticket QR
                  </button>
                </>
              )}
              {t.status === "redeemed" && t.redeemedAt && (
                <p className="text-sm">
                  Used at {formatTime(t.redeemedAt)}
                  {t.redeemedVehicle && <> on {t.redeemedVehicle}</>}, {formatDateTime(t.redeemedAt)}
                </p>
              )}
              {t.status === "expired" && <p className="text-sm">Expired at {formatDateTime(t.expiresAt)} without being used.</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
