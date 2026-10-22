"use client";

import "leaflet/dist/leaflet.css";
import { latLngBounds } from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { CAMPUS_CENTER, campus } from "@/data/campus";
import { edgeName } from "@/lib/graph";
import { REPORT_TYPES } from "@/lib/reports";
import type { CampusEdge, LatLng, Report } from "@/lib/types";

export type CampusMapProps = {
  routeEdgeIds: string[];
  fromPlaceId: string;
  toPlaceId: string;
  reports: Report[];
  /** When true, clicking the map picks a location for a report. */
  picking: boolean;
  onPick: (point: LatLng) => void;
  highlightEdgeId?: string;
  onSetPlace: (placeId: string, end: "from" | "to") => void;
  onShowDetails: (placeId: string) => void;
};

const edges = [...campus.edges.values()];
const places = [...campus.places.values()];

const isNotable = (edge: CampusEdge) => edge.steps > 0 || edge.surface !== "paved" || edge.slopePercent >= 8;

// Dash patterns carry meaning without relying on colour alone.
function edgeStyle(edge: CampusEdge) {
  if (edge.steps > 0) return { color: "#b91c1c", dashArray: "2 6", weight: 4, opacity: 0.9 };
  if (edge.surface !== "paved") return { color: "#92400e", dashArray: "8 6", weight: 3, opacity: 0.8 };
  if (edge.slopePercent >= 8) return { color: "#c2410c", weight: 4, opacity: 0.8 };
  return { color: "#64748b", weight: 2, opacity: 0.35 };
}

function PickHandler({ enabled, onPick }: { enabled: boolean; onPick: (p: LatLng) => void }) {
  const map = useMapEvents({
    click(e) {
      if (enabled) onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  useEffect(() => {
    map.getContainer().style.cursor = enabled ? "crosshair" : "";
  }, [map, enabled]);
  return null;
}

function FitRoute({ edgeIds }: { edgeIds: string[] }) {
  const map = useMap();
  useEffect(() => {
    if (edgeIds.length === 0) return;
    const points = edgeIds.flatMap((id) => campus.edges.get(id)!.geometry);
    map.fitBounds(latLngBounds(points), { padding: [40, 40], maxZoom: 18 });
  }, [map, edgeIds]);
  return null;
}

export default function CampusMap({
  routeEdgeIds,
  fromPlaceId,
  toPlaceId,
  reports,
  picking,
  onPick,
  highlightEdgeId,
  onSetPlace,
  onShowDetails,
}: CampusMapProps) {
  return (
    <MapContainer
      center={[CAMPUS_CENTER.lat, CAMPUS_CENTER.lng]}
      zoom={16}
      preferCanvas
      className="h-full w-full"
      aria-label="Campus map. Everything on the map is also available in the route planner."
    >
      <TileLayer
        attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Elevation: Copernicus DEM via Open-Meteo`}
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {edges.map((edge) => (
        <Polyline key={edge.id} positions={edge.geometry} pathOptions={edgeStyle(edge)}>
          {isNotable(edge) && (
            <Tooltip sticky>
              {edgeName(edge)}
              {edge.steps > 0 && ` · ${edge.steps} steps`}
              {edge.slopePercent >= 5 && ` · about ${Math.round(edge.slopePercent)}% slope`}
              {edge.surface !== "paved" && ` · ${edge.surface}`}
            </Tooltip>
          )}
        </Polyline>
      ))}

      {routeEdgeIds.map((id) => (
        <Polyline
          key={`route-${id}`}
          positions={campus.edges.get(id)!.geometry}
          pathOptions={{ color: "#1d4ed8", weight: 8, opacity: 0.9 }}
        />
      ))}

      {[fromPlaceId, toPlaceId].map((id) => {
        const place = campus.places.get(id)!;
        const node = campus.nodes.get(place.nodeId)!;
        return (
          <Polyline
            key={`approach-${id}`}
            positions={[
              [place.lat, place.lng],
              [node.lat, node.lng],
            ]}
            pathOptions={{ color: "#1d4ed8", weight: 4, dashArray: "1 8", opacity: 0.9 }}
          />
        );
      })}

      {highlightEdgeId && (
        <Polyline
          positions={campus.edges.get(highlightEdgeId)!.geometry}
          pathOptions={{ color: "#f59e0b", weight: 10, opacity: 0.9 }}
        />
      )}

      {places.map((place) => {
        const isEnd = place.id === fromPlaceId || place.id === toPlaceId;
        return (
          <CircleMarker
            key={place.id}
            center={[place.lat, place.lng]}
            radius={isEnd ? 11 : 8}
            pathOptions={{
              color: "#0f172a",
              weight: 2,
              fillColor: place.id === fromPlaceId ? "#15803d" : place.id === toPlaceId ? "#1d4ed8" : "#ffffff",
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {place.name}
            </Tooltip>
            <Popup>
              <strong>{place.name}</strong>
              <br />
              {place.accessibility.stepFreeEntrance === null
                ? "Accessibility not yet surveyed"
                : place.accessibility.stepFreeEntrance
                  ? "Step-free entrance"
                  : "No step-free entrance"}
              {place.accessibility.lift && " · Lift"}
              {place.accessibility.accessibleToilet && " · Accessible toilet"}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-400 px-2 py-1"
                  onClick={() => onSetPlace(place.id, "from")}
                >
                  Start here
                </button>
                <button
                  type="button"
                  className="rounded bg-blue-700 px-2 py-1 text-white"
                  onClick={() => onSetPlace(place.id, "to")}
                >
                  Go here
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-400 px-2 py-1"
                  onClick={() => onShowDetails(place.id)}
                >
                  Details
                </button>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {reports.map((report) => (
        <CircleMarker
          key={report.id}
          center={[report.lat, report.lng]}
          radius={9}
          pathOptions={{
            color: "#7f1d1d",
            weight: 3,
            fillColor: report.status === "verified" ? "#dc2626" : "#fbbf24",
            fillOpacity: 0.9,
          }}
        >
          <Tooltip>
            {REPORT_TYPES[report.type]} ({report.status === "verified" ? "verified" : "unverified"})
            {report.description && `: ${report.description}`}
          </Tooltip>
        </CircleMarker>
      ))}

      <PickHandler enabled={picking} onPick={onPick} />
      <FitRoute edgeIds={routeEdgeIds} />
    </MapContainer>
  );
}
