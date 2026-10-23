"use client";

import { type FormEvent, useState } from "react";
import { DemoBanner } from "@/components/demo-banner";
import { api } from "@/lib/client/api";
import { formatNaira } from "@/lib/money";
import type { OwnTicket, Route } from "@/lib/types";

export function BuyTicket({
  routes,
  balanceKobo,
  onBought,
}: {
  routes: Route[];
  balanceKobo: number | null;
  onBought: (ticket: OwnTicket) => void;
}) {
  const [routeId, setRouteId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const route = routes.find((r) => r.id === routeId);
  const short = route && balanceKobo !== null && balanceKobo < route.fareKobo ? route.fareKobo - balanceKobo : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!route) return;
    setBusy(true);
    setMessage("");
    try {
      // Only the route id is sent; the server decides the price.
      const { ticket } = await api<{ ticket: OwnTicket }>("/api/tickets", { body: { routeId: route.id } });
      setRouteId(null);
      onBought(ticket);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="buy-heading" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="buy-heading" className="text-lg font-bold">
        Buy a ticket
      </h2>
      <DemoBanner>fares are example values for this project, not OAU&apos;s real fares.</DemoBanner>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Choose your route</legend>
          {routes.length === 0 && <p className="text-muted">Loading routes…</p>}
          {routes.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 has-checked:border-primary has-checked:ring-2 has-checked:ring-primary"
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="route"
                  value={r.id}
                  checked={routeId === r.id}
                  onChange={() => setRouteId(r.id)}
                  className="size-5 accent-(--primary)"
                />
                <span>{r.name}</span>
              </span>
              <span className="font-bold tabular-nums">{formatNaira(r.fareKobo)}</span>
            </label>
          ))}
        </fieldset>
        {short > 0 && (
          <p className="text-sm text-danger">
            Your balance is {formatNaira(short)} short for this fare. Top up first.
          </p>
        )}
        <button
          type="submit"
          disabled={!route || busy || short > 0}
          className="rounded-md bg-primary px-4 py-3 text-lg font-bold text-primary-fg disabled:opacity-60"
        >
          {route ? `Pay ${formatNaira(route.fareKobo)} from wallet` : "Choose a route"}
        </button>
        <p role="alert" className="min-h-5 text-sm text-danger">
          {message}
        </p>
      </form>
    </section>
  );
}
