"use client";

import { campus } from "@/data/campus";
import { formatDistance } from "@/lib/advisory";
import { distance } from "@/lib/geo";
import { CATEGORY_LABELS, formatOpeningHours, googleWalkingUrl, nearbyPlaces, osmUrl } from "@/lib/places";
import { describeReport } from "@/lib/reports";
import type { Place, Report } from "@/lib/types";

function Badge({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  const style =
    ok === true
      ? "border-ok text-ok"
      : ok === false
        ? "border-border text-muted line-through"
        : "border-dashed border-border text-muted";
  return (
    <li className={`rounded-full border px-2.5 py-0.5 text-sm ${style}`}>
      <span className="sr-only">{ok === true ? "Has " : ok === false ? "No " : ""}</span>
      {children}
      {ok === null && <span className="text-xs"> · not surveyed</span>}
    </li>
  );
}

const WHEELCHAIR_TAG: Record<string, string> = {
  yes: "fully accessible",
  limited: "partly accessible",
  no: "not accessible",
};

type Props = {
  place: Place;
  reports: Report[];
  onGo: (placeId: string) => void;
  /** Shown when the card describes a place other than the current destination. */
  onClose?: () => void;
};

export function PlaceDetails({ place, reports, onGo, onClose }: Props) {
  const tags = place.osmTags ?? {};
  const gap = distance(place, campus.nodes.get(place.nodeId)!);
  const placeReports = reports.filter((r) => r.placeId === place.id);
  const osm = osmUrl(place);

  const facts: [string, React.ReactNode][] = [];
  if (tags["building:levels"]) facts.push(["Floors", tags["building:levels"]]);
  if (tags.opening_hours) facts.push(["Opening hours", formatOpeningHours(tags.opening_hours)]);
  if (tags.cuisine) facts.push(["Food", tags.cuisine.replaceAll(";", ", ")]);
  if (tags.operator) facts.push(["Run by", tags.operator]);
  if (tags.phone) {
    facts.push([
      "Phone",
      <a key="phone" href={`tel:${tags.phone.replaceAll(" ", "")}`} className="underline">
        {tags.phone}
      </a>,
    ]);
  }
  if (tags.website) {
    facts.push([
      "Website",
      <a key="web" href={tags.website} target="_blank" rel="noreferrer" className="break-all underline">
        {tags.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
      </a>,
    ]);
  }
  if (gap > 25) facts.push(["Nearest mapped path", `${formatDistance(gap)} away`]);

  return (
    <section aria-labelledby="place-heading" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{CATEGORY_LABELS[place.category]}</p>
          <h2 id="place-heading" className="text-lg font-bold">
            {place.name}
          </h2>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm underline">
            Close
          </button>
        )}
      </div>
      <p className="text-sm text-muted">{place.description}</p>

      <ul className="flex flex-wrap gap-2" aria-label="Accessibility features">
        <Badge ok={place.accessibility.stepFreeEntrance}>Step-free entrance</Badge>
        <Badge ok={place.accessibility.ramp}>Ramp</Badge>
        <Badge ok={place.accessibility.lift}>Lift</Badge>
        <Badge ok={place.accessibility.accessibleToilet}>Accessible toilet</Badge>
      </ul>
      {tags.wheelchair && WHEELCHAIR_TAG[tags.wheelchair] && (
        <p className="text-sm">
          OpenStreetMap lists it as <strong>{WHEELCHAIR_TAG[tags.wheelchair]}</strong> for wheelchairs.
        </p>
      )}
      {place.accessibility.notes && <p className="text-sm">{place.accessibility.notes}</p>}

      {placeReports.length > 0 && (
        <ul className="flex flex-col gap-1">
          {placeReports.map((r) => (
            <li key={r.id} className="rounded bg-warn-bg px-2 py-1 text-sm text-warn-fg">
              ⚠ {describeReport(r)}
            </li>
          ))}
        </ul>
      )}

      {facts.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {facts.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="font-semibold">{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {place.inside && place.inside.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold">Inside</p>
          <ul className="list-disc pl-5">
            {place.inside.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-sm">
        <p className="font-semibold">Nearby</p>
        <ul className="flex flex-col gap-1">
          {nearbyPlaces(campus, place).map(({ place: near, distance: d }) => (
            <li key={near.id} className="flex items-center justify-between gap-2">
              <span>
                {near.name} <span className="text-muted">· {formatDistance(d)}</span>
              </span>
              <button
                type="button"
                onClick={() => onGo(near.id)}
                className="shrink-0 rounded border border-border px-2 py-0.5 text-xs"
              >
                Go here
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a href={googleWalkingUrl(place)} target="_blank" rel="noreferrer" className="underline">
          Open in Google Maps
        </a>
        {osm && (
          <a href={osm} target="_blank" rel="noreferrer" className="underline">
            View on OpenStreetMap
          </a>
        )}
      </div>
    </section>
  );
}
