import { type Db, ts } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import type { Route, Vehicle } from "@/lib/types";

interface RouteRow {
  id: number;
  name: string;
  origin: string;
  destination: string;
  fare_kobo: number;
  active: boolean;
}

const toRoute = (r: RouteRow): Route => ({
  id: r.id,
  name: r.name,
  origin: r.origin,
  destination: r.destination,
  fareKobo: r.fare_kobo,
  active: r.active,
});

export async function listRoutes(db: Db, { includeInactive = false } = {}): Promise<Route[]> {
  const sql = `SELECT * FROM {schema}.routes ${includeInactive ? "" : "WHERE active"} ORDER BY name`;
  return (await db.query<RouteRow>(sql)).map(toRoute);
}

export async function getRoute(db: Db, id: number): Promise<Route | undefined> {
  if (!Number.isSafeInteger(id)) return undefined;
  const r = await db.maybeOne<RouteRow>("SELECT * FROM {schema}.routes WHERE id = $1", [id]);
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

export async function createRoute(db: Db, input: RouteInput, now = Date.now()): Promise<Route> {
  const r = await db.one<RouteRow>(
    `INSERT INTO {schema}.routes (name, origin, destination, fare_kobo, active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [input.name, input.origin, input.destination, input.fareKobo, input.active, ts(now)],
  );
  return toRoute(r);
}

/** Fare changes apply to new purchases only; sold tickets keep the fare they were bought at. */
export async function updateRoute(db: Db, id: number, input: Partial<RouteInput>, now = Date.now()): Promise<Route> {
  const current = await getRoute(db, id);
  if (!current) throw new AppError("Route not found.", 404);
  const next = { ...current, ...input };
  const r = await db.one<RouteRow>(
    `UPDATE {schema}.routes SET name = $1, origin = $2, destination = $3, fare_kobo = $4, active = $5, updated_at = $6
     WHERE id = $7 RETURNING *`,
    [next.name, next.origin, next.destination, next.fareKobo, next.active, ts(now), id],
  );
  return toRoute(r);
}

export async function listVehicles(db: Db): Promise<Vehicle[]> {
  const rows = await db.query<{ id: number; name: string; route_id: number | null; route_name: string | null }>(
    `SELECT v.id, v.name, v.route_id, r.name AS route_name
     FROM {schema}.vehicles v LEFT JOIN {schema}.routes r ON r.id = v.route_id ORDER BY v.name`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, routeId: r.route_id, routeName: r.route_name }));
}

export async function getVehicle(db: Db, id: number): Promise<Vehicle | undefined> {
  return (await listVehicles(db)).find((v) => v.id === id);
}

export async function createVehicle(db: Db, name: string, routeId: number | null): Promise<Vehicle> {
  const clean = name.trim();
  if (!clean || clean.length > 40) throw new AppError("Enter a vehicle name of 1–40 characters.");
  if (routeId !== null && !(await getRoute(db, routeId))) throw new AppError("Unknown route.");
  const inserted = await db.query<{ id: number }>(
    "INSERT INTO {schema}.vehicles (name, route_id) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING RETURNING id",
    [clean, routeId],
  );
  if (!inserted.length) throw new AppError("A vehicle with that name already exists.");
  return (await getVehicle(db, inserted[0].id))!;
}

export async function setVehicleRoute(db: Db, vehicleId: number, routeId: number | null): Promise<Vehicle> {
  if (routeId !== null && !(await getRoute(db, routeId))) throw new AppError("Unknown route.");
  if (!Number.isSafeInteger(vehicleId)) throw new AppError("Vehicle not found.", 404);
  const updated = await db.query("UPDATE {schema}.vehicles SET route_id = $1 WHERE id = $2 RETURNING id", [
    routeId,
    vehicleId,
  ]);
  if (!updated.length) throw new AppError("Vehicle not found.", 404);
  return (await getVehicle(db, vehicleId))!;
}
