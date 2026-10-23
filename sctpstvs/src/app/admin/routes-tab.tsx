"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { DemoBanner } from "@/components/demo-banner";
import { api } from "@/lib/client/api";
import { KOBO_PER_NAIRA } from "@/lib/money";
import type { Route } from "@/lib/types";
import { ErrorText, buttonClass, inputClass, secondaryButtonClass } from "./ui";

export function RoutesTab() {
  const [routes, setRoutes] = useState<Route[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(() => {
    api<{ routes: Route[] }>("/api/admin/routes")
      .then((r) => setRoutes(r.routes))
      .catch((err: Error) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  async function save(id: number, changes: Record<string, unknown>, label: string) {
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/routes/${id}`, { method: "PATCH", body: changes });
      setMessage(`Saved ${label}.`);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <DemoBanner>seeded fares are example values, not OAU&apos;s real fares. A fare change applies to new purchases only.</DemoBanner>
      <ErrorText message={error} />
      {message && (
        <p role="status" className="text-sm text-ok">
          {message}
        </p>
      )}
      {routes === null ? (
        <p role="status">Loading…</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {routes.map((r) => (
            <RouteRow key={`${r.id}-${r.fareKobo}-${r.active}`} route={r} onSave={save} />
          ))}
        </ul>
      )}
      <AddRoute onAdded={load} />
    </>
  );
}

function RouteRow({
  route,
  onSave,
}: {
  route: Route;
  onSave: (id: number, changes: Record<string, unknown>, label: string) => void;
}) {
  const [fare, setFare] = useState(String(route.fareKobo / KOBO_PER_NAIRA));
  const changed = fare !== String(route.fareKobo / KOBO_PER_NAIRA);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSave(route.id, { fareNaira: Number(fare) }, `the fare for ${route.name}`);
  }

  return (
    <li className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="min-w-0">
        <p className="font-bold">
          {route.name} {!route.active && <span className="font-normal text-danger">(not on sale)</span>}
        </p>
        <p className="text-sm text-muted">
          {route.origin} → {route.destination}
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`fare-${route.id}`} className="text-sm font-semibold">
            Fare (₦)
          </label>
          <input
            id={`fare-${route.id}`}
            inputMode="numeric"
            value={fare}
            onChange={(e) => setFare(e.target.value.replace(/\D/g, ""))}
            className={`${inputClass} w-24 tabular-nums`}
          />
        </div>
        <button type="submit" disabled={!changed || !fare} className={buttonClass}>
          Save fare
        </button>
        <button
          type="button"
          onClick={() => onSave(route.id, { active: !route.active }, route.active ? `${route.name} (off sale)` : `${route.name} (on sale)`)}
          className={`${secondaryButtonClass} py-2`}
        >
          {route.active ? "Stop selling" : "Start selling"}
        </button>
      </form>
    </li>
  );
}

function AddRoute({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState({ name: "", origin: "", destination: "", fareNaira: "" });
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/admin/routes", { body: { ...form, fareNaira: Number(form.fareNaira) } });
      setForm({ name: "", origin: "", destination: "", fareNaira: "" });
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const field = (key: keyof typeof form, label: string, extra = "") => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`new-${key}`} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={`new-${key}`}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: key === "fareNaira" ? e.target.value.replace(/\D/g, "") : e.target.value })}
        inputMode={key === "fareNaira" ? "numeric" : undefined}
        className={`${inputClass} ${extra}`}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-lg font-bold">Add a route</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("name", "Name (e.g. Angola Hall – SUB)")}
        {field("fareNaira", "Fare (₦)")}
        {field("origin", "From")}
        {field("destination", "To")}
      </div>
      <button type="submit" className={`${buttonClass} self-start`}>
        Add route
      </button>
      <ErrorText message={error} />
    </form>
  );
}
