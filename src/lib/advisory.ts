import { bearing, compassDirection, distance, headingChange } from "./geo";
import { edgeName, type Graph, orientedGeometry } from "./graph";
import { PROFILES } from "./profiles";
import { blockedEdgeIds, describeReport, isActive } from "./reports";
import { findPath, travelTime } from "./routing";
import type { CampusEdge, Report, RouteOptions, RouteResult, RouteStep } from "./types";

const roundDistance = (m: number) => Math.max(10, Math.round(m / 10) * 10);

/** Gaps shorter than this between a building and the mapped network are ignored. */
const APPROACH_THRESHOLD_M = 25;
const UNMAPPED_WARNING = "This stretch is not on the map yet; check the way on site.";

function turnPhrase(change: number): string {
  const abs = Math.abs(change);
  const side = change < 0 ? "left" : "right";
  if (abs < 30) return "Continue";
  if (abs < 60) return `Bear ${side}`;
  if (abs < 150) return `Turn ${side}`;
  return "Turn around";
}

const toLatLng = ([lat, lng]: [number, number]) => ({ lat, lng });

function segmentWarnings(edge: CampusEdge, options: RouteOptions): string[] {
  const warnings: string[] = [];
  const slope = Math.round(edge.slopePercent);
  if (edge.steps > 0) warnings.push(`${edge.steps} steps`);
  if (slope >= 8) warnings.push(`Steep slope (about ${slope}%)`);
  else if (slope >= 5) warnings.push(`Moderate slope (about ${slope}%)`);
  if (edge.surface === "rough") warnings.push("Rough, uneven surface");
  if (edge.surface === "unpaved") warnings.push("Unpaved path");
  if (edge.kerbRamps === false && options.profile !== "standard") warnings.push("No dropped kerbs");
  if (edge.lit === false && options.avoidUnlit) warnings.push("Not lit after dark");
  return warnings;
}

/**
 * Plans a route between two places and turns it into spoken-style
 * directions with accessibility warnings. Returns null when no route
 * suits the chosen profile.
 */
export function planRoute(
  graph: Graph,
  fromPlaceId: string,
  toPlaceId: string,
  options: RouteOptions,
  reports: Report[] = [],
): RouteResult | null {
  const from = graph.places.get(fromPlaceId);
  const to = graph.places.get(toPlaceId);
  if (!from || !to) return null;

  const path = findPath(graph, from.nodeId, to.nodeId, options, blockedEdgeIds(reports));
  if (!path) return null;

  const profile = PROFILES[options.profile];
  const active = reports.filter(isActive);
  const steps: RouteStep[] = [];
  let distanceTotal = 0;
  let duration = 0;
  let previousHeading: number | null = null;

  path.edgeIds.forEach((edgeId, i) => {
    const edge = graph.edges.get(edgeId)!;
    const name = edgeName(edge);
    const geometry = orientedGeometry(edge, path.nodeIds[i]).map(toLatLng);
    const startHeading = bearing(geometry[0], geometry[1]);
    distanceTotal += edge.length;
    duration += travelTime(edge, profile);

    const warnings = [
      ...segmentWarnings(edge, options),
      ...active.filter((r) => r.edgeId === edge.id).map(describeReport),
    ];

    const last = steps.at(-1);
    const lastEdge = last && graph.edges.get(last.edgeIds.at(-1)!);
    if (last && lastEdge && edgeName(lastEdge) === name) {
      // Same path: extend the current instruction instead of adding one.
      last.distance += edge.length;
      last.edgeIds.push(edge.id);
      for (const w of warnings) if (!last.warnings.includes(w)) last.warnings.push(w);
    } else {
      const verb =
        previousHeading === null
          ? `Head ${compassDirection(startHeading)}`
          : turnPhrase(headingChange(previousHeading, startHeading));
      const article = edge.name ? "" : "the ";
      steps.push({
        instruction: `${verb} ${previousHeading === null ? "along" : "onto"} ${article}${name}`,
        distance: edge.length,
        edgeIds: [edge.id],
        warnings,
      });
    }
    previousHeading = bearing(geometry.at(-2)!, geometry.at(-1)!);
  });

  for (const step of steps) {
    step.instruction += ` for ${roundDistance(step.distance)} m`;
  }

  // Buildings sit off the mapped network; account for the walk to and from it.
  const leave = distance(from, graph.nodes.get(from.nodeId)!);
  const reach = distance(to, graph.nodes.get(to.nodeId)!);
  if (leave > APPROACH_THRESHOLD_M) {
    steps.unshift({
      instruction: `Leave ${from.name} and walk about ${roundDistance(leave)} m to the start of the route`,
      distance: leave,
      edgeIds: [],
      warnings: [UNMAPPED_WARNING],
    });
  }
  if (reach > APPROACH_THRESHOLD_M) {
    steps.push({
      instruction: `Walk about ${roundDistance(reach)} m to the entrance of ${to.name}`,
      distance: reach,
      edgeIds: [],
      warnings: [UNMAPPED_WARNING],
    });
  }
  for (const gap of [leave, reach]) {
    if (gap > APPROACH_THRESHOLD_M) {
      distanceTotal += gap;
      duration += gap / profile.speed;
    }
  }
  steps.push({ instruction: `Arrive at ${to.name}`, distance: 0, edgeIds: [], warnings: [] });

  const advisories: string[] = [];
  const access = to.accessibility;
  if (access.stepFreeEntrance === false) advisories.push(`${to.name} has no step-free entrance.`);
  if (options.profile !== "standard") {
    if (access.lift === false) advisories.push(`${to.name} has no lift; upper floors are stairs only.`);
    if (access.accessibleToilet === false) advisories.push(`${to.name} has no accessible toilet.`);
    if (Object.values(access).some((v) => v === null)) {
      advisories.push(`Some accessibility details for ${to.name} have not been surveyed yet.`);
    }
  }
  if (access.notes) advisories.push(access.notes);
  for (const report of active.filter((r) => r.placeId === to.id)) {
    advisories.push(describeReport(report));
  }

  const restPoints = path.nodeIds
    .slice(1, -1)
    .map((id) => graph.nodes.get(id)!.restPoint)
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
