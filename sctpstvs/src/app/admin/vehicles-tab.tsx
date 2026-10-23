"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { Route, Vehicle } from "@/lib/types";
import { ErrorText, buttonClass, inputClass } from "./ui";

export function VehiclesTab() {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [name, setName] = useState("");
  const [newRoute, setNewRoute] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    Promise.all([api<{ vehicles: Vehicle[] }>("/api/vehicles"), api<{ routes: Route[] }>("/api/admin/routes")])
      .then(([v, r]) => {
        setVehicles(v.vehicles);
        setRoutes(r.routes);
      })
      .catch((err: Error) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  async function assign(id: number, routeId: string) {
    setError("");
    try {
      await api(`/api/admin/vehicles/${id}`, { method: "PATCH", body: { routeId: routeId ? Number(routeId) : null } });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/admin/vehicles", { body: { name, routeId: newRoute ? Number(newRoute) : null } });
      setName("");
      setNewRoute("");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const routeOptions = (
    <>
      <option value="">Any route (no route check)</option>
      {routes.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </>
  );

  return (
    <>
      <p className="text-muted">
        A conductor picks their vehicle before scanning. Tickets for a different route show WRONG ROUTE and stay unused.
      </p>
      <ErrorText message={error} />
      {vehicles === null ? (
        <p role="status">Loading…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {vehicles.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
              <label htmlFor={`veh-${v.id}`} className="font-bold">
                {v.name}
              </label>
              <select
                id={`veh-${v.id}`}
                value={v.routeId ?? ""}
                onChange={(e) => assign(v.id, e.target.value)}
                className={`${inputClass} max-w-full`}
              >
                {routeOptions}
              </select>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-bold">Add a vehicle</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="veh-name" className="text-sm font-semibold">
              Name (e.g. Bus 6)
            </label>
            <input id="veh-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="veh-route" className="text-sm font-semibold">
              Route
            </label>
            <select id="veh-route" value={newRoute} onChange={(e) => setNewRoute(e.target.value)} className={inputClass}>
              {routeOptions}
            </select>
          </div>
        </div>
        <button type="submit" disabled={!name.trim()} className={`${buttonClass} self-start`}>
          Add vehicle
        </button>
      </form>
    </>
  );
}
