"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/client/api";
import { TICKET_STATUS_LABELS } from "@/lib/labels";
import { formatNaira } from "@/lib/money";
import { formatDateTime, formatTime } from "@/lib/time";
import type { AdminTicket, Route, TicketStatus } from "@/lib/types";
import { ErrorText, TableBox, inputClass, secondaryButtonClass } from "./ui";

export function TicketsTab() {
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [routeId, setRouteId] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ routes: Route[] }>("/api/admin/routes")
      .then((r) => setRoutes(r.routes))
      .catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (routeId) params.set("routeId", routeId);
    if (q.trim()) params.set("q", q.trim());
    api<{ tickets: AdminTicket[] }>(`/api/admin/tickets?${params}`)
      .then((r) => {
        setTickets(r.tickets);
        setError("");
      })
      .catch((err: Error) => setError(err.message));
  }, [status, routeId, q]);

  // Debounce typing in the search box.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function refund(t: AdminTicket) {
    if (!confirm(`Refund ${formatNaira(t.fareKobo)} to ${t.holderName} for ticket ${t.shortCode}?`)) return;
    try {
      await api(`/api/admin/tickets/${encodeURIComponent(t.id)}/refund`, { body: {} });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="f-status" className="text-sm font-semibold">
            Status
          </label>
          <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | "")} className={inputClass}>
            <option value="">All</option>
            {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((s) => (
              <option key={s} value={s}>
                {TICKET_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-route" className="text-sm font-semibold">
            Route
          </label>
          <select id="f-route" value={routeId} onChange={(e) => setRouteId(e.target.value)} className={inputClass}>
            <option value="">All routes</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-q" className="text-sm font-semibold">
            Search matric, name or code
          </label>
          <input id="f-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} />
        </div>
      </div>
      <ErrorText message={error} />
      {tickets === null ? (
        <p role="status">Loading…</p>
      ) : tickets.length === 0 ? (
        <p className="text-muted">No tickets match.</p>
      ) : (
        <>
          <p className="text-sm text-muted" role="status">
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
            {tickets.length >= 300 && " (showing the latest 300)"}
          </p>
          <TableBox label="Tickets">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Holder</th>
                <th scope="col">Route</th>
                <th scope="col">Bought</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="font-mono whitespace-nowrap">{t.shortCode}</td>
                  <td>
                    {t.holderName}
                    <span className="block font-mono text-xs text-muted">{t.holderMatric}</span>
                  </td>
                  <td>
                    {t.routeName}
                    <span className="block text-xs text-muted">{formatNaira(t.fareKobo)}</span>
                  </td>
                  <td className="whitespace-nowrap">{formatDateTime(t.issuedAt)}</td>
                  <td>
                    <StatusBadge status={t.status} />
                    {t.status === "redeemed" && t.redeemedAt && (
                      <span className="block text-xs text-muted">
                        {formatTime(t.redeemedAt)}
                        {t.redeemedVehicle && ` · ${t.redeemedVehicle}`}
                        {t.redeemedByName && ` · ${t.redeemedByName}`}
                      </span>
                    )}
                  </td>
                  <td>
                    {(t.status === "active" || t.status === "expired") && (
                      <button type="button" onClick={() => refund(t)} className={secondaryButtonClass}>
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableBox>
        </>
      )}
    </>
  );
}
