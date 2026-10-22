import { distance } from "./geo";
import { createGraph } from "./graph";
import type { CampusEdge, CampusNode, PlaceInput } from "./types";

/*
 * A small hand-made network with known features (stairs shortcuts, an
 * unlit unpaved path, a steep hill) so routing tests have predictable answers.
 */
const nodes: CampusNode[] = [
  { id: "n-bus", lat: 7.5192, lng: 4.5195 },
  { id: "n-sub", lat: 7.5207, lng: 4.5213 },
  { id: "n-amph", lat: 7.5179, lng: 4.5212 },
  { id: "n-senate", lat: 7.5186, lng: 4.5222 },
  { id: "n-lib", lat: 7.5197, lng: 4.5236 },
  { id: "n-arts", lat: 7.5191, lng: 4.525 },
  { id: "n-sci", lat: 7.5212, lng: 4.5245 },
  { id: "n-tech", lat: 7.5222, lng: 4.5262 },
  { id: "n-socsci", lat: 7.5175, lng: 4.525 },
  { id: "n-oduduwa", lat: 7.5168, lng: 4.5233 },
  { id: "n-health", lat: 7.5158, lng: 4.5268 },
  { id: "n-moremi", lat: 7.5128, lng: 4.5258 },
  { id: "n-awo", lat: 7.5136, lng: 4.5222 },
  { id: "n-fajuyi", lat: 7.5147, lng: 4.5205 },
  { id: "j-ring-w", lat: 7.5195, lng: 4.5208 },
  { id: "j-senate-sq", lat: 7.519, lng: 4.5228 },
  { id: "j-lib-front", lat: 7.5202, lng: 4.524 },
  { id: "j-east", lat: 7.52, lng: 4.5258 },
  { id: "j-south", lat: 7.5172, lng: 4.5222 },
  { id: "j-south-e", lat: 7.5165, lng: 4.5252 },
  { id: "j-hall-road", lat: 7.515, lng: 4.523 },
  { id: "j-moremi-gate", lat: 7.5138, lng: 4.525 },
];
const byId = new Map(nodes.map((n) => [n.id, n]));

/** Terrain for the elevation profile: the fixture campus rises towards the north. */
export const fixtureElevation = (node: CampusNode) => 250 + (node.lat - 7.5128) * 5000;

const path = (
  id: string,
  from: string,
  to: string,
  name: string,
  attrs: Partial<Omit<CampusEdge, "id" | "from" | "to" | "name" | "geometry" | "length" | "elevation">> = {},
): CampusEdge => {
  const a = byId.get(from)!;
  const b = byId.get(to)!;
  const length = distance(a, b);
  return {
    id,
    from,
    to,
    name,
    highway: attrs.steps ? "steps" : "footway",
    geometry: [
      [a.lat, a.lng],
      [b.lat, b.lng],
    ],
    length,
    elevation: [fixtureElevation(a), fixtureElevation(b)],
    surface: "paved",
    slopePercent: 2,
    steps: 0,
    lit: true,
    tactilePaving: false,
    kerbRamps: true,
    ...attrs,
  };
};

const edges: CampusEdge[] = [
  path("e1", "n-bus", "j-ring-w", "Shuttle park walkway", { slopePercent: 1 }),
  path("e2", "j-ring-w", "n-sub", "SUB road"),
  path("e3", "j-ring-w", "n-amph", "Amphitheatre walkway", { slopePercent: 3 }),
  path("e4", "n-amph", "j-south", "Amphitheatre south path"),
  path("e5", "n-amph", "n-senate", "Amphitheatre steps", { steps: 12, slopePercent: 0 }),
  path("e6", "j-ring-w", "j-senate-sq", "Senate road", { slopePercent: 4 }),
  path("e7", "n-senate", "j-senate-sq", "Senate forecourt", { slopePercent: 1, tactilePaving: true }),
  path("e8", "j-senate-sq", "j-lib-front", "Library walkway", { slopePercent: 5 }),
  path("e9", "j-lib-front", "n-lib", "Library ramp", { slopePercent: 6, tactilePaving: true }),
  path("e10", "n-senate", "n-lib", "Senate–Library stairs", { steps: 20, slopePercent: 0 }),
  path("e11", "j-lib-front", "n-sci", "Science road", { slopePercent: 3 }),
  path("e12", "n-sub", "n-sci", "SUB–Science footpath", {
    surface: "unpaved",
    slopePercent: 4,
    lit: false,
    kerbRamps: false,
  }),
  path("e13", "n-sci", "n-tech", "Science–Technology road", { slopePercent: 7 }),
  path("e14", "j-lib-front", "j-east", "East walkway"),
  path("e15", "j-east", "n-tech", "Technology approach", { slopePercent: 4 }),
  path("e16", "j-east", "n-arts", "Arts walkway"),
  path("e17", "n-arts", "j-senate-sq", "Arts shortcut steps", { steps: 8, slopePercent: 0 }),
  path("e18", "n-arts", "n-socsci", "Arts–Social Sciences path", { slopePercent: 3 }),
  path("e19", "j-senate-sq", "j-south", "Senate south road", { slopePercent: 3 }),
  path("e20", "j-south", "n-oduduwa", "Oduduwa approach"),
  path("e21", "n-oduduwa", "j-south-e", "Oduduwa east path", { slopePercent: 4, lit: false }),
  path("e22", "n-socsci", "j-south-e", "Social Sciences path"),
  path("e23", "j-south-e", "n-health", "Health Centre road", { slopePercent: 3 }),
  path("e24", "j-south", "j-hall-road", "Hall road", { slopePercent: 6 }),
  path("e25", "j-hall-road", "n-awo", "Awolowo Hall road"),
  path("e26", "j-hall-road", "n-fajuyi", "Fajuyi Hall road", { slopePercent: 3 }),
  path("e27", "n-fajuyi", "j-ring-w", "Fajuyi back path", {
    surface: "rough",
    slopePercent: 9,
    lit: false,
    kerbRamps: false,
  }),
  path("e28", "j-hall-road", "j-moremi-gate", "Moremi road", { slopePercent: 4 }),
  path("e29", "j-moremi-gate", "n-moremi", "Moremi Hall gate"),
  path("e30", "n-health", "j-moremi-gate", "Health Centre hill", { slopePercent: 10 }),
  path("e31", "n-oduduwa", "j-hall-road", "Oduduwa steps", { steps: 15, slopePercent: 0 }),
];

const surveyed = { stepFreeEntrance: true, ramp: true, lift: true, accessibleToilet: true };
const at = (nodeId: string) => ({ lat: byId.get(nodeId)!.lat, lng: byId.get(nodeId)!.lng });

const places: PlaceInput[] = [
  { id: "shuttle-park", name: "Shuttle Park", category: "transport", description: "", accessibility: surveyed, ...at("n-bus") },
  { id: "senate", name: "Senate", category: "admin", description: "", accessibility: surveyed, ...at("n-senate") },
  { id: "library", name: "Library", category: "library", description: "", accessibility: surveyed, ...at("n-lib") },
  { id: "sub", name: "SUB", category: "student-life", description: "", accessibility: surveyed, ...at("n-sub") },
  { id: "science", name: "Science", category: "academic", description: "", accessibility: surveyed, ...at("n-sci") },
  { id: "health", name: "Health Centre", category: "health", description: "", accessibility: surveyed, ...at("n-health") },
  {
    id: "fajuyi",
    name: "Fajuyi Hall",
    category: "hall",
    description: "",
    accessibility: { ...surveyed, stepFreeEntrance: false },
    ...at("n-fajuyi"),
  },
];

export const fixture = createGraph(nodes, edges, places, [
  { name: "Senate square benches", ...at("j-senate-sq") },
]);
