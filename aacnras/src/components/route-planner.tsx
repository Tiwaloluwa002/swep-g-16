"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { campus, DATA_VERIFIED } from "@/data/campus";
import { formatDistance, formatDuration, planRoute } from "@/lib/advisory";
import { nearestEdge } from "@/lib/graph";
import { PROFILE_LIST, PROFILES } from "@/lib/profiles";
import { isActive } from "@/lib/reports";
import { routeDetails } from "@/lib/route-details";
import { updateSettings, useSettings } from "@/lib/settings";
import { speak, stopSpeaking, useSpeechSupported } from "@/lib/speech";
import type { LatLng, Report, RouteResult } from "@/lib/types";
import { PlaceDetails } from "./place-details";
import { PlaceSelect } from "./place-select";
import { ReportForm } from "./report-form";
import { RouteDetailsPanel } from "./route-details-panel";
import { SettingsPanel } from "./settings-panel";

const CampusMap = dynamic(() => import("./campus-map"), {
  ssr: false,
  loading: () => <p className="p-4 text-muted">Loading map…</p>,
});

function spokenDirections(route: RouteResult, destination: string): string {
  const steps = route.steps.map((s) => [s.instruction, ...s.warnings].join(". "));
  return [
    `Route to ${destination}: ${formatDistance(route.distance)}, about ${formatDuration(route.duration)}.`,
    ...steps,
    ...route.advisories,
  ].join(". ");
}

export function RoutePlanner() {
  const settings = useSettings();
  const canSpeak = useSpeechSupported();
  const [fromId, setFromId] = useState("sub");
  const [toId, setToId] = useState("library");
  const [avoidUnlit, setAvoidUnlit] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<{ point: LatLng; edgeId: string } | null>(null);
  const [chosenEdgeId, setChosenEdgeId] = useState<string>();
  /** A place opened from the map or "Nearby"; null shows the destination. */
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const loadReports = useCallback(() => {
    fetch("/api/reports")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Report[]) => setReports(data.filter(isActive)))
      .catch(() => setReports([]));
  }, []);
  useEffect(loadReports, [loadReports]);

  const profile = PROFILES[settings.profile];
  const destination = campus.places.get(toId)!;
  const route = useMemo(
    () => planRoute(campus, fromId, toId, { profile: settings.profile, avoidUnlit }, reports),
    [fromId, toId, settings.profile, avoidUnlit, reports],
  );
  const details = useMemo(() => route && routeDetails(campus, route, fromId, toId), [route, fromId, toId]);

  useEffect(() => {
    if (settings.voice && route) speak(spokenDirections(route, destination.name));
    return stopSpeaking;
  }, [settings.voice, route, destination.name]);

  const setPlace = (placeId: string, end: "from" | "to") => {
    if (end === "from") setFromId(placeId);
    else setToId(placeId);
    setDetailsId(null);
  };
  const showDetails = (placeId: string) => {
    setDetailsId(placeId === toId ? null : placeId);
    requestAnimationFrame(() => document.getElementById("place-details")?.scrollIntoView({ behavior: "smooth" }));
  };
  const detailsPlace = campus.places.get(detailsId ?? toId)!;

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <header className="border-b border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-xl font-bold leading-tight">AACNRAS</h1>
            <p className="text-sm text-muted">Accessible campus navigation · Obafemi Awolowo University</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              aria-expanded={showSettings}
              aria-controls="settings"
              className="rounded-md border border-border px-3 py-2 text-sm font-semibold"
            >
              Display &amp; voice
            </button>
            <Link href="/about" className="rounded-md px-3 py-2 text-sm underline">
              About
            </Link>
          </div>
        </div>
        {showSettings && (
          <section id="settings" aria-label="Display and voice settings" className="border-t border-border px-4 py-3">
            <SettingsPanel />
          </section>
        )}
      </header>

      {!DATA_VERIFIED && (
        <p className="bg-warn-bg px-4 py-2 text-sm text-warn-fg">
          Prototype: building positions and path details are estimates until the on-site survey is complete.
        </p>
      )}

      <main id="main" className="flex min-w-0 flex-1 flex-col lg:min-h-0 lg:flex-row">
        <div className="relative flex w-full flex-col gap-6 overflow-y-auto border-border bg-surface p-4 lg:w-[26rem] lg:border-r">
          {reporting ? (
            <ReportForm
              picked={picked}
              picking={picking}
              onTogglePicking={() => setPicking((p) => !p)}
              onEdgeChange={(id) => {
                setPicked(null);
                setChosenEdgeId(id);
              }}
              onSubmitted={loadReports}
              onClose={() => {
                setReporting(false);
                setPicking(false);
                setPicked(null);
                setChosenEdgeId(undefined);
              }}
            />
          ) : (
            <>
              <section aria-labelledby="plan-heading" className="flex flex-col gap-4">
                <h2 id="plan-heading" className="text-lg font-bold">
                  Plan a route
                </h2>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-semibold">How are you travelling?</legend>
                  {PROFILE_LIST.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer gap-3 rounded-md border border-border p-3 has-checked:border-primary has-checked:ring-2 has-checked:ring-primary"
                    >
                      <input
                        type="radio"
                        name="profile"
                        value={p.id}
                        checked={settings.profile === p.id}
                        onChange={() => updateSettings({ profile: p.id })}
                        className="mt-1 size-4 shrink-0 accent-primary"
                      />
                      <span>
                        <span className="block font-semibold">{p.label}</span>
                        <span className="block text-sm text-muted">{p.description}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <div className="flex items-end gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    {(["from", "to"] as const).map((end) => (
                      <div key={end} className="flex flex-col gap-1">
                        <label htmlFor={`place-${end}`} className="text-sm font-semibold">
                          {end === "from" ? "From" : "To"}
                        </label>
                        <PlaceSelect
                          id={`place-${end}`}
                          value={end === "from" ? fromId : toId}
                          onChange={(id) => setPlace(id, end)}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFromId(toId);
                      setToId(fromId);
                    }}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                    aria-label="Swap start and destination"
                  >
                    ⇅
                  </button>
                </div>

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={avoidUnlit}
                    onChange={(e) => setAvoidUnlit(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Travelling after dark: prefer lit paths
                </label>
              </section>

              <section aria-labelledby="route-heading" aria-live="polite" className="flex flex-col gap-3">
                <h2 id="route-heading" className="text-lg font-bold">
                  Directions
                </h2>
                {fromId === toId ? (
                  <p className="text-muted">Choose a different destination.</p>
                ) : !route ? (
                  <p className="rounded-md bg-warn-bg p-3 text-warn-fg">
                    No suitable route for <strong>{profile.label.toLowerCase()}</strong>. A path may be blocked; try
                    another profile or ask for assistance.
                  </p>
                ) : (
                  <>
                    <p className="text-lg">
                      <strong>{formatDistance(route.distance)}</strong> · about{" "}
                      <strong>{formatDuration(route.duration)}</strong>
                      <span className="text-sm text-muted"> ({profile.label.toLowerCase()})</span>
                    </p>
                    {canSpeak && (
                      <button
                        type="button"
                        onClick={() => speak(spokenDirections(route, destination.name))}
                        className="self-start rounded-md border border-border px-3 py-1.5 text-sm font-semibold"
                      >
                        🔊 Read directions aloud
                      </button>
                    )}
                    <ol className="flex flex-col gap-2">
                      {route.steps.map((step, i) => (
                        <li key={i} className="rounded-md border border-border p-3">
                          <span className="font-semibold">
                            {i + 1}. {step.instruction}
                          </span>
                          {step.warnings.length > 0 && (
                            <ul className="mt-2 flex flex-col gap-1">
                              {step.warnings.map((w) => (
                                <li key={w} className="rounded bg-warn-bg px-2 py-1 text-sm text-warn-fg">
                                  ⚠ {w}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ol>
                    {route.restPoints.length > 0 && (
                      <p className="text-sm">
                        <strong>Places to rest on the way:</strong> {route.restPoints.join(", ")}.
                      </p>
                    )}
                    {route.advisories.length > 0 && (
                      <ul className="flex flex-col gap-1 text-sm">
                        {route.advisories.map((a) => (
                          <li key={a}>• {a}</li>
                        ))}
                      </ul>
                    )}
                    {details && <RouteDetailsPanel details={details} />}
                  </>
                )}
              </section>

              <div id="place-details" className="scroll-mt-4 rounded-md border border-border p-4">
                <PlaceDetails
                  place={detailsPlace}
                  reports={reports}
                  onGo={(id) => setPlace(id, "to")}
                  onClose={detailsId ? () => setDetailsId(null) : undefined}
                />
              </div>

              <button
                type="button"
                onClick={() => setReporting(true)}
                className="rounded-md border-2 border-danger px-4 py-2.5 font-semibold text-danger"
              >
                Report an obstacle
              </button>
            </>
          )}
        </div>

        <div className="relative h-[70vh] shrink-0 lg:h-auto lg:flex-1">
          <CampusMap
            routeEdgeIds={route?.edgeIds ?? []}
            fromPlaceId={fromId}
            toPlaceId={toId}
            reports={reports}
            picking={reporting && picking}
            onPick={(point) => {
              setPicked({ point, edgeId: nearestEdge(campus, point).edge.id });
              setPicking(false);
            }}
            highlightEdgeId={reporting ? (picked?.edgeId ?? chosenEdgeId) : undefined}
            onSetPlace={setPlace}
            onShowDetails={showDetails}
          />
          <MapLegend />
        </div>
      </main>
    </div>
  );
}

function MapLegend() {
  const items = [
    { label: "Your route", style: "border-t-[6px] border-[#1d4ed8]" },
    { label: "Unmapped stretch", style: "border-t-4 border-dotted border-[#1d4ed8]" },
    { label: "Steps", style: "border-t-4 border-dotted border-[#b91c1c]" },
    { label: "Unpaved / rough", style: "border-t-4 border-dashed border-[#92400e]" },
    { label: "Steep (8%+)", style: "border-t-4 border-[#c2410c]" },
  ];
  return (
    <div className="absolute bottom-6 left-2 z-[1000] rounded-md border border-border bg-surface/95 p-2 text-xs shadow">
      <p className="mb-1 font-semibold">Map key</p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span aria-hidden className={`inline-block w-6 ${item.style}`} />
            {item.label}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-3 rounded-full border-2 border-[#7f1d1d] bg-[#fbbf24]" />
          Reported obstacle
        </li>
      </ul>
    </div>
  );
}
