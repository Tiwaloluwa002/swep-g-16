import { bearing, compassDirection, headingChange } from "./geo";
import { edgeById, edgeLength, nodeById, placeById } from "./graph";
import { PROFILES } from "./profiles";
import { blockedEdgeIds, describeReport, isActive } from "./reports";
import { findPath, travelTime } from "./routing";
import type { CampusEdge, Report, RouteOptions, RouteResult, RouteStep } from "./types";

const roundDistance = (m: number) => Math.max(10, Math.round(m / 10) * 10);

function turnPhrase(change: number): string {
  const abs = Math.abs(change);
  const side = change < 0 ? "left" : "right";
  if (abs < 30) return "Continue";
  if (abs < 60) return `Bear ${side}`;
  if (abs < 150) return `Turn ${side}`;
  return "Turn around";
}

function segmentWarnings(edge: CampusEdge, options: RouteOptions): string[] {
  const warnings: string[] = [];
  if (edge.steps > 0) warnings.push(`${edge.steps} steps`);
  if (edge.slopePercent >= 8) warnings.push(`Steep slope (${edge.slopePercent}%)`);
  else if (edge.slopePercent >= 5) warnings.push(`Moderate slope (${edge.slopePercent}%)`);
  if (edge.surface === "rough") warnings.push("Rough, uneven surface");
  if (edge.surface === "unpaved") warnings.push("Unpaved path");
  if (!edge.kerbRamps && options.profile !== "standard") warnings.push("No dropped kerbs");
  if (!edge.lit && options.avoidUnlit) warnings.push("Not lit after dark");
  return warnings;
}

/**
 * Plans a route between two places and turns it into spoken-style
 * directions with accessibility warnings. Returns null when no route
 * suits the chosen profile.
 */
export function planRoute(
  fromPlaceId: string,
  toPlaceId: string,
  options: RouteOptions,
  reports: Report[] = [],
): RouteResult | null {
  const from = placeById.get(fromPlaceId);
  const to = placeById.get(toPlaceId);
  if (!from || !to) return null;

  const path = findPath(from.nodeId, to.nodeId, options, blockedEdgeIds(reports));
  if (!path) return null;

  const profile = PROFILES[options.profile];
  const active = reports.filter(isActive);
  const steps: RouteStep[] = [];
  let distanceTotal = 0;
  let duration = 0;
  let previousHeading: number | null = null;

  path.edgeIds.forEach((edgeId, i) => {
    const edge = edgeById.get(edgeId)!;
    const start = nodeById.get(path.nodeIds[i])!;
    const end = nodeById.get(path.nodeIds[i + 1])!;
    const length = edgeLength(edge);
    const heading = bearing(start, end);
    distanceTotal += length;
    duration += travelTime(edge, length, profile);

    const warnings = [
      ...segmentWarnings(edge, options),
      ...active.filter((r) => r.edgeId === edge.id).map(describeReport),
    ];

    const last = steps.at(-1);
    const lastEdge = last && edgeById.get(last.edgeIds.at(-1)!);
    if (last && lastEdge?.name === edge.name) {
      // Same named path: extend the current instruction instead of adding one.
      last.distance += length;
      last.edgeIds.push(edge.id);
      for (const w of warnings) if (!last.warnings.includes(w)) last.warnings.push(w);
    } else {
      const verb =
        previousHeading === null
          ? `Head ${compassDirection(heading)}`
          : turnPhrase(headingChange(previousHeading, heading));
      steps.push({
        instruction: `${verb} ${previousHeading === null ? "along" : "onto"} ${edge.name}`,
        distance: length,
        edgeIds: [edge.id],
        warnings,
      });
    }
    previousHeading = heading;
  });

  for (const step of steps) {
    step.instruction += ` for ${roundDistance(step.distance)} m`;
  }
  steps.push({ instruction: `Arrive at ${to.name}`, distance: 0, edgeIds: [], warnings: [] });

  const advisories: string[] = [];
  const access = to.accessibility;
  if (!access.stepFreeEntrance) advisories.push(`${to.name} has no step-free entrance.`);
  if (options.profile !== "standard") {
    if (!access.lift) advisories.push(`${to.name} has no lift; upper floors are stairs only.`);
    if (!access.accessibleToilet) advisories.push(`${to.name} has no accessible toilet.`);
  }
  if (access.notes) advisories.push(access.notes);
  for (const report of active.filter((r) => r.placeId === to.id)) {
    advisories.push(describeReport(report));
  }

  const restPoints = path.nodeIds
    .slice(1, -1)
    .map((id) => nodeById.get(id)!.restPoint)
    .filter((r): r is string => Boolean(r));

  return {
    nodeIds: path.nodeIds,
    edgeIds: path.edgeIds,
    distance: distanceTotal,
    duration,
    steps,
    advisories,
    restPoints,
  };
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${roundDistance(metres)} m`;
}
