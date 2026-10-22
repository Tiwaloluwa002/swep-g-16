import { distance } from "./geo";
import type { Graph } from "./graph";
import { PROFILES } from "./profiles";
import type { CampusEdge, MobilityProfile, RouteOptions } from "./types";

const UNLIT_PENALTY = 3;
/** Lighting not yet recorded: assume it may be dark, but prefer it to known-unlit paths. */
const UNKNOWN_LIGHT_PENALTY = 1.5;
const BUSY_ROADS = new Set(["primary", "secondary", "tertiary"]);

/**
 * Routing cost of a segment for a profile, in "effective seconds".
 * Returns null when the profile cannot use the segment at all.
 * Every multiplier is >= 1, so cost never drops below plain travel time,
 * which keeps the A* heuristic admissible.
 */
export function edgeCost(edge: CampusEdge, profile: MobilityProfile, options: RouteOptions): number | null {
  if (edge.steps > 0 && !profile.allowSteps) return null;
  if (edge.slopePercent > profile.maxSlopePercent) return null;

  let cost = edge.length / profile.speed;
  cost *= 1 + edge.slopePercent * profile.slopeFactor;
  cost *= profile.surfacePenalty[edge.surface];
  if (edge.kerbRamps === false) cost *= profile.noKerbRampPenalty;
  if (edge.tactilePaving !== true) cost *= profile.noTactilePenalty;
  if (BUSY_ROADS.has(edge.highway)) cost *= profile.busyRoadPenalty;
  if (options.avoidUnlit) {
    if (edge.lit === false) cost *= UNLIT_PENALTY;
    else if (edge.lit === null) cost *= UNKNOWN_LIGHT_PENALTY;
  }
  return cost + edge.steps * profile.stepPenalty;
}

/** Realistic travel time for a segment, used for the ETA shown to users. */
export function travelTime(edge: CampusEdge, profile: MobilityProfile): number {
  return (edge.length / profile.speed) * (1 + edge.slopePercent * 0.03) + edge.steps * profile.secondsPerStep;
}

export type Path = { nodeIds: string[]; edgeIds: string[] };

/** A* search over the campus network. Returns null when no usable route exists. */
export function findPath(
  graph: Graph,
  startId: string,
  goalId: string,
  options: RouteOptions,
  blockedEdgeIds: ReadonlySet<string> = new Set(),
): Path | null {
  const start = graph.nodes.get(startId);
  const goal = graph.nodes.get(goalId);
  if (!start || !goal) return null;
  if (startId === goalId) return { nodeIds: [startId], edgeIds: [] };

  const profile = PROFILES[options.profile];
  const heuristic = (id: string) => distance(graph.nodes.get(id)!, goal) / profile.speed;

  const costSoFar = new Map<string, number>([[startId, 0]]);
  const cameFrom = new Map<string, { nodeId: string; edgeId: string }>();
  const open = new Map<string, number>([[startId, heuristic(startId)]]);
  const closed = new Set<string>();

  while (open.size > 0) {
    // The campus graph is small, so a linear scan beats maintaining a heap.
    let current = "";
    let best = Infinity;
    for (const [id, f] of open) {
      if (f < best) [current, best] = [id, f];
    }
    open.delete(current);

    if (current === goalId) {
      const nodeIds = [goalId];
      const edgeIds: string[] = [];
      for (let step = cameFrom.get(goalId); step; step = cameFrom.get(step.nodeId)) {
        nodeIds.unshift(step.nodeId);
        edgeIds.unshift(step.edgeId);
      }
      return { nodeIds, edgeIds };
    }
    closed.add(current);

    for (const { edge, nodeId } of graph.adjacency.get(current)!) {
      if (closed.has(nodeId) || blockedEdgeIds.has(edge.id)) continue;
      const cost = edgeCost(edge, profile, options);
      if (cost === null) continue;
      const tentative = costSoFar.get(current)! + cost;
      if (tentative < (costSoFar.get(nodeId) ?? Infinity)) {
        costSoFar.set(nodeId, tentative);
        cameFrom.set(nodeId, { nodeId: current, edgeId: edge.id });
        open.set(nodeId, tentative + heuristic(nodeId));
      }
    }
  }
  return null;
}
