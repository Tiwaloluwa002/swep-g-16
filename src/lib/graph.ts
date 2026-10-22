import { edges, nodes, places } from "@/data/campus";
import { distance, distanceToSegment } from "./geo";
import type { CampusEdge, CampusNode, LatLng, Place } from "./types";

export const nodeById = new Map<string, CampusNode>(nodes.map((n) => [n.id, n]));
export const edgeById = new Map<string, CampusEdge>(edges.map((e) => [e.id, e]));
export const placeById = new Map<string, Place>(places.map((p) => [p.id, p]));

export type Neighbour = { edge: CampusEdge; nodeId: string; length: number };

/** Adjacency list; every edge is walkable in both directions. */
export const adjacency = new Map<string, Neighbour[]>(nodes.map((n) => [n.id, []]));
for (const edge of edges) {
  const a = nodeById.get(edge.from);
  const b = nodeById.get(edge.to);
  if (!a || !b) throw new Error(`Edge ${edge.id} references an unknown node`);
  const length = distance(a, b);
  adjacency.get(a.id)!.push({ edge, nodeId: b.id, length });
  adjacency.get(b.id)!.push({ edge, nodeId: a.id, length });
}

export function edgeLength(edge: CampusEdge): number {
  return distance(nodeById.get(edge.from)!, nodeById.get(edge.to)!);
}

export function nearestEdge(point: LatLng): { edge: CampusEdge; distance: number } {
  let best = { edge: edges[0], distance: Infinity };
  for (const edge of edges) {
    const d = distanceToSegment(point, nodeById.get(edge.from)!, nodeById.get(edge.to)!);
    if (d < best.distance) best = { edge, distance: d };
  }
  return best;
}

export function nearestPlace(point: LatLng): { place: Place; distance: number } {
  let best = { place: places[0], distance: Infinity };
  for (const place of places) {
    const d = distance(point, nodeById.get(place.nodeId)!);
    if (d < best.distance) best = { place, distance: d };
  }
  return best;
}
