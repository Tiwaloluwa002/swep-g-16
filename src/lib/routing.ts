import { adjacency, nodeById } from "./graph";
import { distance } from "./geo";
import { PROFILES } from "./profiles";
import type { CampusEdge, MobilityProfile, RouteOptions } from "./types";

const UNLIT_PENALTY = 3;

/**
 * Routing cost of a segment for a profile, in "effective seconds".
 * Returns null when the profile cannot use the segment at all.
 * Every multiplier is >= 1, so cost never drops below plain travel time,
 * which keeps the A* heuristic admissible.
 */
export function edgeCost(
  edge: CampusEdge,
  length: number,
  profile: MobilityProfile,
  options: RouteOptions,
): number | null {
  if (edge.steps > 0 && !profile.allowSteps) return null;
  if (edge.slopePercent > profile.maxSlopePercent) return null;

  let cost = length / profile.speed;
  cost *= 1 + edge.slopePercent * profile.slopeFactor;
  cost *= profile.surfacePenalty[edge.surface];
  if (!edge.kerbRamps) cost *= profile.noKerbRampPenalty;
  if (!edge.tactilePaving) cost *= profile.noTactilePenalty;
  if (options.avoidUnlit && !edge.lit) cost *= UNLIT_PENALTY;
  return cost + edge.steps * profile.stepPenalty;
}

/** Realistic travel time for a segment, used for the ETA shown to users. */
export function travelTime(edge: CampusEdge, length: number, profile: MobilityProfile): number {
  return (length / profile.speed) * (1 + edge.slopePercent * 0.03) + edge.steps * profile.secondsPerStep;
}

export type Path = { nodeIds: string[]; edgeIds: string[] };

/** A* search over the campus network. Returns null when no usable route exists. */
export function findPath(
  startId: string,
  goalId: string,
  options: RouteOptions,
  blockedEdgeIds: ReadonlySet<string> = new Set(),
): Path | null {
  const start = nodeById.get(startId);
  const goal = nodeById.get(goalId);
  if (!start || !goal) return null;
  if (startId === goalId) return { nodeIds: [startId], edgeIds: [] };

  const profile = PROFILES[options.profile];
  const heuristic = (id: string) => distance(nodeById.get(id)!, goal) / profile.speed;

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

    for (const { edge, nodeId, length } of adjacency.get(current)!) {
      if (closed.has(nodeId) || blockedEdgeIds.has(edge.id)) continue;
      const cost = edgeCost(edge, length, profile, options);
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
