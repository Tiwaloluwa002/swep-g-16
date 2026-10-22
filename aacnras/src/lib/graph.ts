import { distance, distanceToSegment } from "./geo";
import type { CampusEdge, CampusNode, LatLng, Place, PlaceInput, RestPointInput } from "./types";

export type Neighbour = { edge: CampusEdge; nodeId: string };

export type Graph = {
  nodes: Map<string, CampusNode>;
  edges: Map<string, CampusEdge>;
  adjacency: Map<string, Neighbour[]>;
  places: Map<string, Place>;
};

const HIGHWAY_LABELS: Record<string, string> = {
  footway: "footpath",
  path: "footpath",
  pedestrian: "pedestrian walkway",
  steps: "steps",
  track: "dirt track",
  service: "service road",
};

/** Human-readable name for a segment, falling back to its kind of path. */
export function edgeName(edge: CampusEdge): string {
  return edge.name ?? HIGHWAY_LABELS[edge.highway] ?? "campus road";
}

/** Nodes in the largest connected part of the network. */
function mainComponent(nodes: CampusNode[], adjacency: Map<string, Neighbour[]>): Set<string> {
  const seen = new Set<string>();
  let best = new Set<string>();
  for (const { id } of nodes) {
    if (seen.has(id)) continue;
    const component = new Set([id]);
    const stack = [id];
    while (stack.length) {
      for (const { nodeId } of adjacency.get(stack.pop()!)!) {
        if (!component.has(nodeId)) {
          component.add(nodeId);
          stack.push(nodeId);
        }
      }
    }
    component.forEach((n) => seen.add(n));
    if (component.size > best.size) best = component;
  }
  return best;
}

/**
 * Builds a routable graph. Places and rest points are snapped to the
 * nearest node in the main connected network, so every place is reachable
 * by at least the standard profile.
 */
export function createGraph(
  nodeList: CampusNode[],
  edgeList: CampusEdge[],
  placeList: PlaceInput[],
  restPoints: RestPointInput[] = [],
): Graph {
  const nodes = new Map(nodeList.map((n) => [n.id, { ...n }]));
  const edges = new Map(edgeList.map((e) => [e.id, e]));
  const adjacency = new Map<string, Neighbour[]>(nodeList.map((n) => [n.id, []]));
  for (const edge of edgeList) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) throw new Error(`Edge ${edge.id} references an unknown node`);
    adjacency.get(edge.from)!.push({ edge, nodeId: edge.to });
    adjacency.get(edge.to)!.push({ edge, nodeId: edge.from });
  }

  const reachable = [...mainComponent(nodeList, adjacency)].map((id) => nodes.get(id)!);
  const snap = (point: LatLng) =>
    reachable.reduce((best, n) => (distance(point, n) < distance(point, best) ? n : best)).id;

  for (const rest of restPoints) nodes.get(snap(rest))!.restPoint = rest.name;
  const places = new Map(placeList.map((p) => [p.id, { ...p, nodeId: snap(p) }]));

  return { nodes, edges, adjacency, places };
}

/** Geometry of an edge in the direction of travel starting at `fromNodeId`. */
export function orientedGeometry(edge: CampusEdge, fromNodeId: string): [number, number][] {
  return edge.from === fromNodeId ? edge.geometry : [...edge.geometry].reverse();
}

export function nearestEdge(graph: Graph, point: LatLng): { edge: CampusEdge; distance: number } {
  let best: { edge: CampusEdge; distance: number } | null = null;
  for (const edge of graph.edges.values()) {
    for (let i = 1; i < edge.geometry.length; i++) {
      const [aLat, aLng] = edge.geometry[i - 1];
      const [bLat, bLng] = edge.geometry[i];
      const d = distanceToSegment(point, { lat: aLat, lng: aLng }, { lat: bLat, lng: bLng });
      if (!best || d < best.distance) best = { edge, distance: d };
    }
  }
  if (!best) throw new Error("The graph has no edges");
  return best;
}
