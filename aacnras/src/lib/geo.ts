import type { LatLng } from "./types";

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in metres. */
export function distance(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Initial bearing from a to b, in degrees clockwise from north (0–360). */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

export function compassDirection(deg: number): string {
  return COMPASS[Math.round(deg / 45) % 8];
}

/** Signed change of heading in degrees, -180..180 (negative = left). */
export function headingChange(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/** Closest point on segment ab to p, using a flat projection (fine at campus scale). */
export function distanceToSegment(p: LatLng, a: LatLng, b: LatLng): number {
  const kx = Math.cos(toRad(p.lat));
  const ax = a.lng * kx, ay = a.lat;
  const bx = b.lng * kx, by = b.lat;
  const px = p.lng * kx, py = p.lat;
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return distance(p, { lat: ay + t * dy, lng: (ax + t * dx) / kx });
}
