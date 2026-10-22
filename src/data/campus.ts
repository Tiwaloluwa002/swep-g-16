import { createGraph } from "@/lib/graph";
import type { CampusEdge, CampusNode, PlaceAccessibility, PlaceCategory, PlaceInput, RestPointInput } from "@/lib/types";
import osm from "./osm-network.json";
import osmPlaces from "./osm-places.json";

/*
 * OAU Ile-Ife campus walking network.
 *
 * Paths come from OpenStreetMap (`npm run import:osm` refreshes them) and
 * slopes are estimated from a 90 m terrain model. Places and their details
 * (opening hours, floors…) are from OpenStreetMap too, with a curated list
 * of key buildings on top. Building accessibility features start as null
 * ("not surveyed"); fill them in from the on-site survey, and record path
 * corrections in `pathCorrections`. Set DATA_VERIFIED once that is done.
 */
export const DATA_VERIFIED = false;
export const CAMPUS_CENTER = { lat: 7.5185, lng: 4.5225 };

type Correction = Partial<Pick<CampusEdge, "name" | "surface" | "slopePercent" | "steps" | "lit" | "tactilePaving" | "kerbRamps">>;

/**
 * Survey corrections, keyed by OpenStreetMap way id (`w<id>`, applies to the
 * whole way) or edge id (`w<id>-<n>`, applies to one segment).
 * Example: w123456789: { slopePercent: 9, kerbRamps: false }
 */
const pathCorrections: Record<string, Correction> = {};

const nodes: CampusNode[] = osm.nodes.map(([id, lat, lng]) => ({ id: String(id), lat: Number(lat), lng: Number(lng) }));

// JSON imports widen literal types, so restate the shape the import script writes.
type OsmEdge = CampusEdge & { wayId: number };
const edges: CampusEdge[] = (osm.edges as unknown as OsmEdge[]).map(({ wayId, ...edge }) => ({
  ...edge,
  ...pathCorrections[`w${wayId}`],
  ...pathCorrections[edge.id],
}));

const notSurveyed: PlaceAccessibility = {
  stepFreeEntrance: null,
  ramp: null,
  lift: null,
  accessibleToilet: null,
};

type OsmPlace = { id: string; name: string; lat: number; lng: number; tags: Record<string, string> };
const osmById = new Map((osmPlaces as unknown as OsmPlace[]).map((p) => [p.id, p]));

/** OpenStreetMap's wheelchair tag only answers the step-free entrance question. */
function osmAccessibility(tags: Record<string, string>): Partial<PlaceAccessibility> {
  if (tags.wheelchair === "yes") return { stepFreeEntrance: true };
  if (tags.wheelchair === "no") return { stepFreeEntrance: false };
  return {};
}

/** A curated place, positioned and enriched from its OpenStreetMap features. */
function place(
  id: string,
  name: string,
  category: PlaceCategory,
  osmIds: string[],
  description: string,
  extra: Partial<Pick<PlaceInput, "accessibility" | "inside">> = {},
): PlaceInput {
  const source = osmById.get(osmIds[0]);
  if (!source) throw new Error(`${id}: OpenStreetMap feature ${osmIds[0]} not found; re-run the import`);
  return {
    id,
    name,
    category,
    lat: source.lat,
    lng: source.lng,
    description,
    inside: extra.inside,
    osmIds,
    osmTags: source.tags,
    accessibility: { ...notSurveyed, ...osmAccessibility(source.tags), ...extra.accessibility },
  };
}

const curated: PlaceInput[] = [
  place("senate", "University Senate Building", "admin", ["w617712377"], "University administration and registry."),
  place("library", "Hezekiah Oluwasanmi Library", "library", ["w617712369"], "Main university library."),
  place("amphitheatre", "Amphitheatre", "student-life", ["w617712375"], "Open-air venue for events and gatherings."),
  place("oduduwa", "Oduduwa Hall", "student-life", ["w617712376"], "Main auditorium for convocations and large events."),
  place("sub", "Student Union Building (SUB)", "student-life", ["w616403563"], "Student union offices, eateries and shops."),
  place("arts", "Faculty of Arts", "academic", ["w617712372"], "Faculty of Arts, Block 2."),
  place("social-sciences", "Faculty of Social Sciences", "academic", ["w617712366"], "Social science departments."),
  place("law", "Faculty of Law", "academic", ["w617712365"], "Law faculty."),
  place("education", "Faculty of Education", "academic", ["w617712367", "n14002436331", "n14002459514"], "Education faculty."),
  place("administration", "Faculty of Administration", "academic", ["w617712368"], "Administration faculty."),
  place("first-bank-lt", "First Bank Lecture Theatre", "academic", ["r14909933"], "Large lecture theatre."),
  place("hslt", "Humanities Lecture Theatres (HSLT)", "academic", ["w618243403", "w618243404", "w618243405"], "HSLT A, B and C lecture theatres."),
  place("technology", "Faculty of Technology", "academic", ["w599038666"], "Engineering departments and lecture theatres."),
  place("central-science-lab", "Central Science Laboratory", "academic", ["w599038653"], "Shared science laboratories."),
  place("pharmacy", "Faculty of Pharmacy", "academic", ["w618243408"], "Pharmacy faculty."),
  place("1000-seater", "1000 Seater Lecture Theatre", "academic", ["w617712421"], "Large lecture theatre."),
  place("health-centre", "OAU Health Centre", "health", ["w619971213"], "Campus clinic and emergency care."),
  place("sports-centre", "OAU Sports Centre", "sports", ["w625664968"], "Sports centre."),
  place("moremi", "Moremi Hall", "hall", ["w619270924"], "Hall of residence."),
  place("fajuyi", "Adekunle Fajuyi Hall", "hall", ["w619368836"], "Hall of residence."),
  place("awolowo", "Awolowo Hall", "hall", ["w618217519"], "Hall of residence."),
  place("etf", "ETF Hall", "hall", ["w619368837"], "Hall of residence."),
  place("alumni", "Alumni Hall", "hall", ["w620253753"], "Hall of residence."),
  place("mozambique", "Mozambique Hall", "hall", ["w617970630"], "Hall of residence."),
  place("angola", "Angola Hall", "hall", ["w617970610"], "Hall of residence."),
  place("postgraduate-hall", "Postgraduate Hall", "hall", ["w620256439"], "Postgraduate hall of residence."),
];

/** OpenStreetMap features left out: mis-tagged, duplicates, the campus outline or under construction. */
const SKIP = new Set([
  "n14002385621", // "Walkway" tagged as a fixme point
  "n14002480131", // "Social Science Walkway" tagged as a building
  "n14002430934", // second "Faculty of Arts" point with conflicting tags
  "n14002430036", // Faculty of Arts main building, under construction
  "w1552256471", // the whole university outline
]);

function classify(tags: Record<string, string>, name: string): [PlaceCategory, string] {
  const amenity = tags.amenity;
  if (amenity === "bank" || /\bbank\b/i.test(name) || name === "Ecobank") {
    return ["bank", tags.opening_hours ? "Bank." : "Bank. Opening hours not recorded."];
  }
  if (amenity === "restaurant" || amenity === "cafe" || amenity === "fast_food") {
    return ["food", tags.cuisine ? `Restaurant: ${tags.cuisine.replaceAll(";", ", ")}.` : "Restaurant."];
  }
  if (tags.shop) return ["food", "Shop."];
  if (tags.tourism === "hostel") return ["hall", "Hall of residence."];
  if (tags.building === "mosque") return ["worship", "Mosque."];
  if (tags.building === "church") return ["worship", "Church."];
  if (amenity === "parking") return ["parking", "Car park."];
  if (amenity === "hospital" || tags.healthcare) return ["health", "Health facility."];
  if (tags.leisure) return ["sports", "Sports facility."];
  if (tags.tourism === "museum") return ["student-life", "Museum."];
  if (amenity === "library") return ["library", "Library."];
  if (tags.building === "university" || amenity === "university" || amenity === "college" || amenity === "school") {
    return ["academic", "University building."];
  }
  return ["other", "Campus building."];
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Every other named OpenStreetMap feature on campus, deduplicated by name. */
function importedPlaces(): PlaceInput[] {
  const taken = new Set(curated.flatMap((p) => p.osmIds ?? []));
  const names = new Set(curated.map((p) => p.name.toLowerCase()));
  const result: PlaceInput[] = [];
  for (const p of osmById.values()) {
    if (taken.has(p.id) || SKIP.has(p.id) || names.has(p.name.toLowerCase())) continue;
    names.add(p.name.toLowerCase());
    const [category, description] = classify(p.tags, p.name);
    result.push({
      id: `${slug(p.name)}-${p.id}`,
      name: p.name,
      category,
      lat: p.lat,
      lng: p.lng,
      description,
      osmIds: [p.id],
      osmTags: p.tags,
      accessibility: { ...notSurveyed, ...osmAccessibility(p.tags) },
    });
  }
  return result;
}

export const places: PlaceInput[] = [...curated, ...importedPlaces()];

/** Benches and shelters found during the survey. */
const restPoints: RestPointInput[] = [];

export const campus = createGraph(nodes, edges, places, restPoints);
