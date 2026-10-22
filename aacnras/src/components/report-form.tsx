"use client";

import { type FormEvent, useState } from "react";
import { campus } from "@/data/campus";
import { edgeName, nearestEdge } from "@/lib/graph";
import { REPORT_TYPES } from "@/lib/reports";
import { PlaceSelect } from "./place-select";
import type { LatLng, ReportType } from "@/lib/types";

type Props = {
  /** Location picked on the map, with the nearest path to it. */
  picked: { point: LatLng; edgeId: string } | null;
  picking: boolean;
  onTogglePicking: () => void;
  onEdgeChange: (edgeId: string | undefined) => void;
  onSubmitted: () => void;
  onClose: () => void;
};

function midpoint(edgeId: string): LatLng {
  const geometry = campus.edges.get(edgeId)!.geometry;
  const [lat, lng] = geometry[Math.floor(geometry.length / 2)];
  return { lat, lng };
}

/** The path segment closest to a building, for reports made without the map. */
const pathNear = (placeId: string) => nearestEdge(campus, campus.places.get(placeId)!).edge.id;

export function ReportForm({ picked, picking, onTogglePicking, onEdgeChange, onSubmitted, onClose }: Props) {
  const [about, setAbout] = useState<"path" | "building">("path");
  const [nearPlaceId, setNearPlaceId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [type, setType] = useState<ReportType>("blocked");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<{ kind: "error" | "ok"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A map pick overrides the dropdown until the user picks something else.
  const edgeId = picked?.edgeId ?? (nearPlaceId ? pathNear(nearPlaceId) : "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const target =
      about === "path"
        ? edgeId && { edgeId, ...(picked?.point ?? midpoint(edgeId)) }
        : placeId && { placeId, lat: campus.places.get(placeId)!.lat, lng: campus.places.get(placeId)!.lng };
    if (!target) {
      setStatus({ kind: "error", message: `Choose the ${about} you are reporting.` });
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        description,
        edgeId: "edgeId" in target ? target.edgeId : undefined,
        placeId: "placeId" in target ? target.placeId : undefined,
        lat: target.lat,
        lng: target.lng,
      }),
    }).catch(() => null);
    setSubmitting(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setStatus({ kind: "error", message: body?.error ?? "Could not send the report. Try again." });
      return;
    }
    setDescription("");
    setStatus({
      kind: "ok",
      message: "Thank you. It shows as a warning on routes now, and routes will avoid it once an admin verifies it.",
    });
    onSubmitted();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-labelledby="report-heading">
      <div className="flex items-center justify-between">
        <h2 id="report-heading" className="text-lg font-bold">
          Report an obstacle
        </h2>
        <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm underline">
          Close
        </button>
      </div>

      <fieldset className="flex gap-4">
        <legend className="mb-1 text-sm font-semibold">What is it about?</legend>
        {(["path", "building"] as const).map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="about"
              value={value}
              checked={about === value}
              onChange={() => {
                setAbout(value);
                setType(value === "path" ? "blocked" : "broken-lift");
                onEdgeChange(value === "path" ? edgeId || undefined : undefined);
              }}
              className="size-4 accent-primary"
            />
            A {value}
          </label>
        ))}
      </fieldset>

      {about === "path" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="report-near" className="text-sm font-semibold">
            Near which building?
          </label>
          <PlaceSelect
            id="report-near"
            value={picked ? "" : nearPlaceId}
            onChange={(id) => {
              setNearPlaceId(id);
              onEdgeChange(id ? pathNear(id) : undefined);
            }}
            placeholder={picked ? "Picked on the map" : "Choose a building…"}
          />
          <button
            type="button"
            onClick={onTogglePicking}
            aria-pressed={picking}
            className="self-start rounded-md border border-border px-3 py-1.5 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-fg"
          >
            {picking ? "Click the map where the obstacle is…" : "Or pick the exact spot on the map"}
          </button>
          {edgeId && (
            <p className="text-sm">
              Selected path: <strong>{edgeName(campus.edges.get(edgeId)!)}</strong> (highlighted on the map)
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="report-place" className="text-sm font-semibold">
            Building
          </label>
          <PlaceSelect id="report-place" value={placeId} onChange={setPlaceId} placeholder="Choose a building…" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="report-type" className="text-sm font-semibold">
          Problem
        </label>
        <select
          id="report-type"
          value={type}
          onChange={(e) => setType(e.target.value as ReportType)}
          className="w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2"
        >
          {Object.entries(REPORT_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="report-description" className="text-sm font-semibold">
          Details <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="report-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="e.g. Trench dug across the walkway near the library"
          className="rounded-md border border-border bg-surface px-3 py-2"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-fg disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send report"}
      </button>

      <p role="status" className={status?.kind === "error" ? "text-danger" : "text-ok"}>
        {status?.message}
      </p>
    </form>
  );
}
