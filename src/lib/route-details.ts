import { distance } from "./geo";
import { edgeName, type Graph } from "./graph";
import type { RouteResult, Surface } from "./types";

export type ProfilePoint = { distance: number; elevation: number };

export type RouteDetails = {
  /** Elevation along the mapped part of the route, metres from its start. */
  profile: ProfilePoint[];
  ascent: number;
  descent: number;
  steepest: { percent: number; name: string } | null;
  steps: number;
  /** Metres of each surface type. */
  surfaces: Record<Surface, number>;
  footpaths: number;
  roads: number;
  lighting: { lit: number; unlit: number; unknown: number };
  /** Places the route passes, in the order you reach them. */
  landmarks: string[];
};

const FOOT_HIGHWAYS = new Set(["footway", "path", "pedestrian", "steps", "track"]);
const LANDMARK_RADIUS_M = 60;
const MAX_LANDMARKS = 5;

export function routeDetails(graph: Graph, route: RouteResult, fromPlaceId: string, toPlaceId: string): RouteDetails {
  const profile: ProfilePoint[] = [];
  const points: { lat: number; lng: number }[] = [];
  const surfaces: Record<Surface, number> = { paved: 0, rough: 0, unpaved: 0 };
  const lighting = { lit: 0, unlit: 0, unknown: 0 };
  let footpaths = 0;
  let roads = 0;
  let steps = 0;
  let steepest: RouteDetails["steepest"] = null;
  let travelled = 0;

  route.edgeIds.forEach((edgeId, i) => {
    const edge = graph.edges.get(edgeId)!;
    const forward = edge.from === route.nodeIds[i];
    const geometry = forward ? edge.geometry : [...edge.geometry].reverse();
    const elevation = forward ? edge.elevation : [...edge.elevation].reverse();

    geometry.forEach(([lat, lng], j) => {
      if (j > 0) travelled += distance(points.at(-1)!, { lat, lng });
      else if (profile.length > 0) return; // shared with the previous edge's last point
      points.push({ lat, lng });
      profile.push({ distance: travelled, elevation: elevation[j] });
    });

    surfaces[edge.surface] += edge.length;
    if (FOOT_HIGHWAYS.has(edge.highway)) footpaths += edge.length;
    else roads += edge.length;
    if (edge.lit === true) lighting.lit += edge.length;
    else if (edge.lit === false) lighting.unlit += edge.length;
    else lighting.unknown += edge.length;
    steps += edge.steps;
    if (edge.slopePercent > (steepest?.percent ?? 0)) {
      steepest = { percent: edge.slopePercent, name: edgeName(edge) };
    }
  });

  let ascent = 0;
  let descent = 0;
  for (let i = 1; i < profile.length; i++) {
    const change = profile[i].elevation - profile[i - 1].elevation;
    if (change > 0) ascent += change;
    else descent -= change;
  }

  const ends = new Set([fromPlaceId, toPlaceId]);
  const landmarks = [...graph.places.values()]
    .filter((p) => !ends.has(p.id))
    .map((p) => ({ name: p.name, at: points.findIndex((pt) => distance(p, pt) <= LANDMARK_RADIUS_M) }))
    .filter((p) => p.at >= 0)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_LANDMARKS)
    .map((p) => p.name);

  return {
    profile,
    ascent: Math.round(ascent),
    descent: Math.round(descent),
    steepest,
    steps,
    surfaces,
    footpaths,
    roads,
    lighting,
    landmarks,
  };
}

/** Share of a total as a whole percentage, for "Paved 80%" style summaries. */
export const percentOf = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
