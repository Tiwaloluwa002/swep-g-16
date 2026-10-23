"use client";

import { useState } from "react";
import { CodeEntry } from "@/components/code-entry";
import { Alert, Badge, Button, Card, Field, inputClass, Loading, NeedsSignIn, PageShell } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { formatDate, formatDateTime, FOUND_STATUS, itemTitle } from "@/lib/format";
import type { DeskItem, FailedAttempt, SessionUser, Stats } from "@/lib/public-types";

type DeskData = { items: DeskItem[]; failedAttempts: FailedAttempt[]; stats: Stats };

const STAT_LABELS: { key: keyof Stats; label: string }[] = [
  { key: "lostReported", label: "Lost reported" },
  { key: "foundReported", label: "Found reported" },
  { key: "matched", label: "Found items matched" },
  { key: "verified", label: "Owners verified" },
  { key: "recovered", label: "Recovered" },
  { key: "failedAttempts", label: "Failed answers" },
];

export function DeskDashboard() {
  const me = useApi<{ user: SessionUser | null }>("/api/me");
  const { data, error, reload } = useApi<DeskData>("/api/desk");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [days, setDays] = useState("60");

  if (error) {
    return (
      <PageShell title="Collection desk">
        <NeedsSignIn status={error.status} message={error.message} />
      </PageShell>
    );
  }
  if (!data) return <Loading />;
  const user = me.data?.user;
  const isAdmin = user?.role === "admin";
  const awaiting = data.items.filter((i) => i.status === "pending_handover");
  const held = data.items.filter((i) => i.status === "open");

  async function act(path: string, body: unknown, ok: string) {
    setMessage(null);
    try {
      const result = await api<{ closed?: number }>(path, { method: body && typeof body === "object" && "status" in body ? "PATCH" : "POST", body });
      setMessage({ kind: "ok", text: result.closed === undefined ? ok : `${ok} ${result.closed} report(s) closed.` });
      reload();
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    }
  }

  return (
    <PageShell
      title={isAdmin ? "Admin dashboard" : (user?.deskName ?? "Collection desk")}
      intro={isAdmin ? "All desks, the failed-claim log and housekeeping." : "Items at your desk, handovers waiting, and failed claims."}
    >
      <section aria-labelledby="stats">
        <h2 id="stats" className="sr-only">
          Statistics
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STAT_LABELS.map((s) => (
            <div key={s.key} className="rounded-lg border border-border bg-surface p-3">
              <dt className="text-sm text-muted">{s.label}</dt>
              <dd className="text-2xl font-bold tabular-nums">{data.stats[s.key]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Card>
        <h2 className="text-lg font-bold">Confirm a handover</h2>
        <p className="text-sm text-muted">Ask the owner for their code (or scan their QR) and check their ID card before handing the item over.</p>
        <CodeEntry onConfirmed={reload} />
      </Card>

      {message && <Alert kind={message.kind}>{message.text}</Alert>}

      <section aria-labelledby="awaiting" className="flex flex-col gap-3">
        <h2 id="awaiting" className="text-xl font-bold">
          Waiting for collection ({awaiting.length})
        </h2>
        {awaiting.length === 0 ? (
          <p className="text-muted">No verified owners waiting.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {awaiting.map((item) => (
              <Card as="li" key={item.id} className="gap-1">
                <h3 className="font-bold">{itemTitle(item)}</h3>
                <p className="text-sm text-muted">
                  {isAdmin && `${item.deskName} · `}Found {formatDate(item.foundDate)} near {item.locationName}
                </p>
                <p className="text-sm">
                  {item.awaitingCollectionUntil
                    ? `Owner's code valid until ${formatDateTime(item.awaitingCollectionUntil)}.`
                    : "Owner's code expired; they can get a new one from their claim page."}
                </p>
              </Card>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="held" className="flex flex-col gap-3">
        <h2 id="held" className="text-xl font-bold">
          Held at the desk ({held.length})
        </h2>
        {held.length === 0 ? (
          <p className="text-muted">Nothing waiting for an owner.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {held.map((item) => (
              <Card as="li" key={item.id} className="gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-bold">{itemTitle(item)}</h3>
                  <Badge>{item.receivedAt ? "At the desk" : "Not yet dropped off"}</Badge>
                </div>
                <p className="text-sm text-muted">
                  {isAdmin && `${item.deskName} · `}Found {formatDate(item.foundDate)} near {item.locationName} · {FOUND_STATUS[item.status]}
                </p>
                <p>{item.description}</p>
                <div className="flex flex-wrap gap-2">
                  {!item.receivedAt && (
                    <Button variant="secondary" className="text-sm" onClick={() => act(`/api/desk/items/${item.id}/received`, {}, "Marked as received.")}>
                      Mark received
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    className="text-sm"
                    onClick={() => window.confirm("Close this found report?") && act(`/api/found/${item.id}`, { status: "closed" }, "Report closed.")}
                  >
                    Close report
                  </Button>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="failed" className="flex flex-col gap-3">
        <h2 id="failed" className="text-xl font-bold">
          Failed claim attempts
        </h2>
        <p className="text-sm text-muted">
          Repeated failures across items can mean someone is fishing for items that are not theirs. Claims lock after 3
          wrong tries; users are limited to 5 tries a day.
        </p>
        {data.failedAttempts.length === 0 ? (
          <p className="text-muted">No failed attempts.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="p-2">
                    When
                  </th>
                  <th scope="col" className="p-2">
                    Claimant
                  </th>
                  <th scope="col" className="p-2">
                    Item
                  </th>
                  <th scope="col" className="p-2">
                    Claim
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.failedAttempts.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="p-2 whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                    <td className="p-2 font-mono">{a.claimantIdent}</td>
                    <td className="p-2">{a.itemSummary}</td>
                    <td className="p-2">{a.claimLocked ? "Locked" : "Open"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isAdmin && (
        <Card>
          <h2 className="text-lg font-bold">Close stale reports</h2>
          <p className="text-sm text-muted">Closes open lost and found reports with no activity for the chosen number of days.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act("/api/desk/close-stale", { days: Number(days) }, "Done.");
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="sm:w-40">
              <Field id="days" label="Inactive for (days)">
                <input id="days" type="number" min={7} max={365} value={days} onChange={(e) => setDays(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <Button type="submit" variant="danger">
              Close stale reports
            </Button>
          </form>
        </Card>
      )}
    </PageShell>
  );
}
