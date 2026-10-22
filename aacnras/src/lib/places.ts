import { distance } from "./geo";
import type { Graph } from "./graph";
import type { Place, PlaceCategory } from "./types";

export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  academic: "Faculties & lecture theatres",
  admin: "Administration",
  library: "Libraries",
  hall: "Halls of residence",
  health: "Health",
  "student-life": "Student life & events",
  sports: "Sports",
  bank: "Banks",
  food: "Food & shops",
  worship: "Places of worship",
  parking: "Car parks",
  transport: "Transport",
  other: "Other",
};

/** Places grouped by category in label order, each group sorted by name. */
export function groupPlaces(graph: Graph): { category: PlaceCategory; label: string; places: Place[] }[] {
  const all = [...graph.places.values()];
  return (Object.keys(CATEGORY_LABELS) as PlaceCategory[])
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      places: all.filter((p) => p.category === category).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.places.length > 0);
}

export function nearbyPlaces(graph: Graph, place: Place, count = 3): { place: Place; distance: number }[] {
  return [...graph.places.values()]
    .filter((p) => p.id !== place.id)
    .map((p) => ({ place: p, distance: distance(place, p) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

const DAYS: Record<string, string> = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun" };

/** Makes OpenStreetMap opening_hours readable: "Mo-Fr 08:00-16:00" → "Mon–Fri 08:00–16:00". */
export function formatOpeningHours(value: string): string {
  return value
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (d) => DAYS[d])
    .replaceAll("-", "–")
    .replaceAll(";", "; ");
}

/** Link to the place's first OpenStreetMap feature, e.g. w617712369 → /way/617712369. */
export function osmUrl(place: Place): string | null {
  const id = place.osmIds?.[0];
  if (!id) return null;
  const type = { n: "node", w: "way", r: "relation" }[id[0]];
  return type ? `https://www.openstreetmap.org/${type}/${id.slice(1)}` : null;
}

export function googleWalkingUrl(place: Place): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking`;
}
