"use client";

import { formatDistance } from "@/lib/advisory";
import { percentOf, type RouteDetails } from "@/lib/route-details";
import { ElevationChart } from "./elevation-chart";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

/** Joins non-zero shares: "Paved 80% · Rough 20%". */
function shares(parts: [string, number][], total: number): string {
  return parts
    .map(([label, metres]) => [label, percentOf(metres, total)] as const)
    .filter(([, pct]) => pct > 0)
    .map(([label, pct]) => `${label} ${pct}%`)
    .join(" · ");
}

export function RouteDetailsPanel({ details }: { details: RouteDetails }) {
  const mapped = details.surfaces.paved + details.surfaces.rough + details.surfaces.unpaved;

  return (
    <details className="rounded-md border border-border p-3" open>
      <summary className="cursor-pointer font-semibold">Route details</summary>
      <div className="mt-3 flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <Stat label="Total climb" value={`↑ ${details.ascent} m`} />
          <Stat label="Total descent" value={`↓ ${details.descent} m`} />
          <Stat
            label="Steepest part"
            value={details.steepest ? `about ${Math.round(details.steepest.percent)}%` : "Flat"}
          />
          <Stat label="Steps" value={details.steps > 0 ? String(details.steps) : "None"} />
        </dl>

        <ElevationChart points={details.profile} />

        <dl className="flex flex-col gap-1 text-sm">
          <div>
            <dt className="inline font-semibold">Surface: </dt>
            <dd className="inline">
              {shares(
                [
                  ["Paved", details.surfaces.paved],
                  ["Rough", details.surfaces.rough],
                  ["Unpaved", details.surfaces.unpaved],
                ],
                mapped,
              )}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">Path type: </dt>
            <dd className="inline">
              {shares(
                [
                  ["Footpaths", details.footpaths],
                  ["Roads", details.roads],
                ],
                mapped,
              )}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">Street lighting: </dt>
            <dd className="inline">
              {shares(
                [
                  ["Lit", details.lighting.lit],
                  ["Unlit", details.lighting.unlit],
                  ["Not recorded", details.lighting.unknown],
                ],
                mapped,
              )}
            </dd>
          </div>
          {details.steepest && details.steepest.percent >= 5 && (
            <div>
              <dt className="inline font-semibold">Steepest section: </dt>
              <dd className="inline">{details.steepest.name}</dd>
            </div>
          )}
          {details.landmarks.length > 0 && (
            <div>
              <dt className="inline font-semibold">You&apos;ll pass: </dt>
              <dd className="inline">{details.landmarks.join(", ")}</dd>
            </div>
          )}
        </dl>
        <p className="text-xs text-muted">
          Covers the {formatDistance(mapped)} on mapped paths. Elevation is estimated from a 90 m terrain model.
        </p>
      </div>
    </details>
  );
}
