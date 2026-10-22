"use client";

import { type KeyboardEvent, type PointerEvent, useId, useRef, useState } from "react";
import type { ProfilePoint } from "@/lib/route-details";

const WIDTH = 360;
const HEIGHT = 140;
const PAD = { top: 12, right: 12, bottom: 24, left: 40 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

/** Clean tick values: round outward to 5 m and keep at least a 10 m span. */
function yDomain(points: ProfilePoint[]): [number, number] {
  const elevations = points.map((p) => p.elevation);
  let lo = Math.floor(Math.min(...elevations) / 5) * 5;
  let hi = Math.ceil(Math.max(...elevations) / 5) * 5;
  if (hi - lo < 10) {
    const mid = (hi + lo) / 2;
    lo = Math.floor((mid - 5) / 5) * 5;
    hi = lo + 10;
  }
  return [lo, hi];
}

/** Every ~50 m, for the table view. */
function sample(points: ProfilePoint[]): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  for (const p of points) {
    if (out.length === 0 || p.distance - out.at(-1)!.distance >= 50) out.push(p);
  }
  if (out.at(-1) !== points.at(-1)) out.push(points.at(-1)!);
  return out;
}

export function ElevationChart({ points }: { points: ProfilePoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const titleId = useId();
  if (points.length < 2) return null;

  const total = points.at(-1)!.distance;
  const [lo, hi] = yDomain(points);
  const x = (d: number) => PAD.left + (d / total) * PLOT_W;
  const y = (e: number) => PAD.top + (1 - (e - lo) / (hi - lo)) * PLOT_H;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.distance).toFixed(1)},${y(p.elevation).toFixed(1)}`).join("");
  const area = `${line}L${x(total).toFixed(1)},${y(lo)}L${x(0)},${y(lo)}Z`;
  const yTicks = [lo, (lo + hi) / 2, hi];

  // The crosshair snaps to the nearest profile point to the pointer.
  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const box = svgRef.current!.getBoundingClientRect();
    const d = (((e.clientX - box.left) / box.width) * WIDTH - PAD.left) / PLOT_W * total;
    let nearest = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.distance - d) < Math.abs(points[nearest].distance - d)) nearest = i;
    });
    setActive(nearest);
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    setActive((i) => Math.min(points.length - 1, Math.max(0, (i ?? -step) + step)));
  }

  const point = active === null ? null : points[active];

  return (
    <figure className="flex flex-col gap-1">
      <figcaption id={titleId} className="text-sm font-semibold">
        Elevation along the route
      </figcaption>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none"
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--muted)">
                {Math.round(t)} m
              </text>
            </g>
          ))}
          {[0, total / 2, total].map((d, i) => (
            <text
              key={d}
              x={x(d)}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
              fontSize={10}
              fill="var(--muted)"
            >
              {Math.round(d)} m
            </text>
          ))}
          <path d={area} fill="var(--primary)" fillOpacity={0.1} />
          <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {point && (
            <g>
              <line
                x1={x(point.distance)}
                x2={x(point.distance)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke="var(--fg)"
                strokeWidth={1}
              />
              <circle
                cx={x(point.distance)}
                cy={y(point.elevation)}
                r={4}
                fill="var(--primary)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
        {point && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded border border-border bg-surface px-2 py-1 text-xs shadow"
            style={{
              left: `${(x(point.distance) / WIDTH) * 100}%`,
              transform: `translateX(${x(point.distance) > WIDTH / 2 ? "-105%" : "5%"})`,
            }}
          >
            <strong>{Math.round(point.elevation)} m</strong> <span className="text-muted">elevation</span>
            <br />
            <span className="text-muted">{Math.round(point.distance)} m along</span>
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Show as a table</summary>
        <table className="mt-1 w-full text-left">
          <thead>
            <tr>
              <th className="font-semibold">Distance along</th>
              <th className="font-semibold">Elevation</th>
            </tr>
          </thead>
          <tbody>
            {sample(points).map((p) => (
              <tr key={p.distance}>
                <td>{Math.round(p.distance)} m</td>
                <td>{Math.round(p.elevation)} m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
