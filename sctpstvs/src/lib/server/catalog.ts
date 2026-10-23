import type { Db } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import type { Route, Vehicle } from "@/lib/types";

interface RouteRow {
  id: number;
  name: string;
  origin: string;
  destination: string;
  fare_kobo: number;
  active: number;
}

const toRoute = (r: RouteRow): Route => ({
  id: r.id,
  name: r.name,
  origin: r.origin,
  destination: r.destination,
  fareKobo: r.fare_kobo,
  active: r.active === 1,
});

export function listRoutes(db: Db, { includeInactive = false } = {}): Route[] {
  const sql = `SELECT * FROM routes ${includeInactive ? "" : "WHERE active = 1"} ORDER BY name`;
  return (db.prepare(sql).all() as unknown as RouteRow[]).map(toRoute);
}

export function getRoute(db: Db, id: number): Route | undefined {
  const r = db.prepare("SELECT * FROM routes WHERE id = ?").get(id) as RouteRow | undefined;
  return r && toRoute(r);
}

export interface RouteInput {
  name: string;
  origin: string;
  destination: string;
  fareKobo: number;
  active: boolean;
}

/** Validates untrusted route fields; returns an error message or the cleaned input. */
export function parseRouteInput(input: unknown, partial = false): Partial<RouteInput> | string {
  if (typeof input !== "object" || input === null) return "Invalid request body.";
  const body = input as Record<string, unknown>;
  const out: Partial<RouteInput> = {};
  for (const key of ["name", "origin", "destination"] as const) {
    if (body[key] === undefined && partial) continue;
    const value = typeof body[key] === "string" ? (body[key] as string).trim() : "";
    if (!value || value.length > 80) return `Enter a ${key} of 1–80 characters.`;
    out[key] = value;
  }
  if (body.fareNaira !== undefined || !partial) {
    const fare = Number(body.fareNaira);
    if (!Number.isInteger(fare) || fare < 10 || fare > 5000) return "Fare must be a whole number from ₦10 to ₦5,000.";
    out.fareKobo = fare * 100;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") return "Invalid active flag.";
    out.active = body.active;
  } else if (!partial) out.active = true;
  return out;
}

export function createRoute(db: Db, input: RouteInput, now = Date.now()): Route {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO routes (name, origin, destination, fare_kobo, active, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(input.name, input.origin, input.destination, input.fareKobo, input.active ? 1 : 0, now);
  return getRoute(db, Number(lastInsertRowid))!;
}

/** Fare changes apply to new purchases only; sold tickets keep the fare they were bought at. */
export function updateRoute(db: Db, id: number, input: Partial<RouteInput>, now = Date.now()): Route {
  const current = getRoute(db, id);
  if (!current) throw new AppError("Route not found.", 404);
  const next = { ...current, ...input };
  db.prepare(
    "UPDATE routes SET name = ?, origin = ?, destination = ?, fare_kobo = ?, active = ?, updated_at = ? WHERE id = ?",
  ).run(next.name, next.origin, next.destination, next.fareKobo, next.active ? 1 : 0, now, id);
  return getRoute(db, id)!;
}

export function listVehicles(db: Db): Vehicle[] {
  const rows = db
    .prepare(
      `SELECT v.id, v.name, v.route_id, r.name AS route_name
       FROM vehicles v LEFT JOIN routes r ON r.id = v.route_id ORDER BY v.name`,
    )
    .all() as { id: number; name: string; route_id: number | null; route_name: string | null }[];
  return rows.map((r) => ({ id: r.id, name: r.name, routeId: r.route_id, routeName: r.route_name }));
}

export function getVehicle(db: Db, id: number): Vehicle | undefined {
  return listVehicles(db).find((v) => v.id === id);
}

export function createVehicle(db: Db, name: string, routeId: number | null): Vehicle {
  const clean = name.trim();
  if (!clean || clean.length > 40) throw new AppError("Enter a vehicle name of 1–40 characters.");
  if (routeId !== null && !getRoute(db, routeId)) throw new AppError("Unknown route.");
  try {
    const { lastInsertRowid } = db.prepare("INSERT INTO vehicles (name, route_id) VALUES (?, ?)").run(clean, routeId);
    return getVehicle(db, Number(lastInsertRowid))!;
  } catch {
    throw new AppError("A vehicle with that name already exists.");
  }
}

export function setVehicleRoute(db: Db, vehicleId: number, routeId: number | null): Vehicle {
  if (routeId !== null && !getRoute(db, routeId)) throw new AppError("Unknown route.");
  const { changes } = db.prepare("UPDATE vehicles SET route_id = ? WHERE id = ?").run(routeId, vehicleId);
  if (!changes) throw new AppError("Vehicle not found.", 404);
  return getVehicle(db, vehicleId)!;
}
