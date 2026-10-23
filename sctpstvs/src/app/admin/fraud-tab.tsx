"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { FRAUD_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/time";
import type { FraudEvent, FraudKind } from "@/lib/types";
import { ErrorText, TableBox, inputClass } from "./ui";

export function FraudTab() {
  const [events, setEvents] = useState<FraudEvent[] | null>(null);
  const [kind, setKind] = useState<FraudKind | "">("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ events: FraudEvent[] }>(`/api/admin/fraud${kind ? `?kind=${kind}` : ""}`)
      .then((r) => setEvents(r.events))
      .catch((err: Error) => setError(err.message));
  }, [kind]);

  return (
    <>
      <p className="text-muted">
        Every rejected scan, reuse attempt and rate-limit hit, newest first. A burst of invalid signatures or reuse from one
        vehicle is worth following up.
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor="f-kind" className="text-sm font-semibold">
          Type
        </label>
        <select id="f-kind" value={kind} onChange={(e) => setKind(e.target.value as FraudKind | "")} className={`${inputClass} self-start`}>
          <option value="">All types</option>
          {(Object.keys(FRAUD_LABELS) as FraudKind[]).map((k) => (
            <option key={k} value={k}>
              {FRAUD_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <ErrorText message={error} />
      {events === null ? (
        <p role="status">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-muted">Nothing recorded.</p>
      ) : (
        <TableBox label="Fraud log">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Type</th>
              <th scope="col">Detail</th>
              <th scope="col">Who / where</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap">{formatDateTime(e.at)}</td>
                <td className="font-semibold">{FRAUD_LABELS[e.kind] ?? e.kind}</td>
                <td>
                  {e.detail}
                  {e.ticketId && <span className="block font-mono text-xs text-muted">Ticket {e.ticketId}</span>}
                </td>
                <td>
                  {[e.actorName, e.vehicle, e.ip].filter(Boolean).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      )}
    </>
  );
}
