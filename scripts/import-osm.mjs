// Imports the OAU walking network and named places from OpenStreetMap, and
// estimates slopes from terrain elevation. Run with `npm run import:osm`; it
// rewrites src/data/osm-network.json and src/data/osm-places.json.
// Map data © OpenStreetMap contributors (ODbL).
//
// The output collapses each OSM way into edges between "graph nodes":
// way endpoints and junctions shared by more than one way.

import { writeFile } from "node:fs/promises";

const BBOX = [7.505, 4.505, 7.53, 4.54]; // south, west, north, east around the main campus
const WALKABLE =
  "footway|path|pedestrian|steps|living_street|residential|unclassified|service|tertiary|secondary|track|cycleway";
const OUT = new URL("../src/data/osm-network.json", import.meta.url);
const PLACES_OUT = new URL("../src/data/osm-places.json", import.meta.url);
const USER_AGENT = "aacnras-oau-swep-project/0.1";

const query = `[out:json][timeout:120];
way["highway"~"^(${WALKABLE})$"]["access"!~"^(private|no)$"](${BBOX.join(",")});
(._;>;);
out body;`;

// Named buildings and amenities; `out center` gives one point per building outline.
const placesQuery = `[out:json][timeout:120];
nwr["name"][~"^(amenity|building|leisure|shop|office|healthcare|tourism)$"~"."](${BBOX.join(",")});
out center tags;`;

/** Tags worth keeping for building details. */
const PLACE_TAGS = [
  "amenity", "building", "leisure", "shop", "office", "healthcare", "tourism", "religion",
  "building:levels", "opening_hours", "wheelchair", "website", "phone", "operator", "cuisine", "description",
];

function overpass(data) {
  return fetchWithRetry("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    body: new URLSearchParams({ data }),
  });
}

/** Elevation in metres from the Copernicus 90 m terrain model via Open-Meteo. */
async function fetchElevations(points) {
  const out = [];
  for (let i = 0; i < points.length; i += 100) {
    const batch = points.slice(i, i + 100);
    const url = new URL("https://api.open-meteo.com/v1/elevation");
    url.searchParams.set("latitude", batch.map((p) => p.lat.toFixed(6)).join(","));
    url.searchParams.set("longitude", batch.map((p) => p.lon.toFixed(6)).join(","));
    out.push(...(await fetchWithRetry(url)).elevation);
    await sleep(1500); // stay well inside the free API's rate limit
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Retries rate limits (429) and temporary server errors (5xx) with backoff. */
async function fetchWithRetry(url, init = { headers: { "user-agent": USER_AGENT } }, attempts = 6) {
  for (let i = 1; ; i++) {
    const res = await fetch(url, init);
    if (res.ok) return res.json();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || i === attempts) throw new Error(`${new URL(url).host} returned ${res.status}`);
    await sleep(5000 * i);
  }
}

const toRad = (d) => (d * Math.PI) / 180;
function distance(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Steepest gradient over windows of at least 90 m: the DEM has 90 m cells, so shorter spans are mostly noise. */
function maxSlope(points, elevation) {
  let max = 0;
  let start = 0;
  let run = 0;
  for (let i = 1; i < points.length; i++) {
    run += distance(points[i - 1], points[i]);
    const last = i === points.length - 1;
    if (run >= 90 || (last && run > 0)) {
      const rise = Math.abs(elevation.get(points[i].id) - elevation.get(points[start].id));
      max = Math.max(max, (rise / Math.max(run, 90)) * 100);
      start = i;
      run = 0;
    }
  }
  return Math.round(max * 10) / 10;
}

const tri = (v) => (v === "yes" ? true : v === "no" ? false : null);
const PAVED = new Set(["paved", "asphalt", "concrete", "paving_stones", "sett", "concrete:plates"]);
const ROUGH = new Set(["compacted", "fine_gravel", "gravel", "cobblestone", "unhewn_cobblestone", "pebblestone"]);
function surfaceOf(tags) {
  if (tags.surface) {
    if (PAVED.has(tags.surface)) return "paved";
    if (ROUGH.has(tags.surface)) return "rough";
    return "unpaved";
  }
  if (tags.highway === "track" || tags.highway === "path") return "unpaved";
  return "paved";
}

const osm = await overpass(query);
const osmNodes = new Map(osm.elements.filter((e) => e.type === "node").map((n) => [n.id, n]));
const ways = osm.elements.filter((e) => e.type === "way");
console.log(`Fetched ${ways.length} ways and ${osmNodes.size} nodes`);

// A node is a graph node if it ends a way or is shared between ways.
const uses = new Map();
for (const way of ways) for (const id of way.nodes) uses.set(id, (uses.get(id) ?? 0) + 1);
const isGraphNode = (way, i) => i === 0 || i === way.nodes.length - 1 || uses.get(way.nodes[i]) > 1;

const usedIds = [...uses.keys()].filter((id) => osmNodes.has(id));
const elevations = await fetchElevations(usedIds.map((id) => osmNodes.get(id)));
const elevation = new Map(usedIds.map((id, i) => [id, elevations[i]]));
console.log(`Fetched ${elevations.length} elevations`);

const graphNodes = new Set();
const edges = [];
for (const way of ways) {
  const tags = way.tags ?? {};
  let start = 0;
  let piece = 0;
  for (let i = 1; i < way.nodes.length; i++) {
    if (!isGraphNode(way, i)) continue;
    const points = way.nodes.slice(start, i + 1).map((id) => osmNodes.get(id));
    if (points.some((p) => !p)) {
      start = i;
      continue;
    }
    const length = points.slice(1).reduce((sum, p, j) => sum + distance(points[j], p), 0);
    const isSteps = tags.highway === "steps";
    edges.push({
      id: `w${way.id}-${piece++}`,
      wayId: way.id,
      from: String(points[0].id),
      to: String(points.at(-1).id),
      name: tags.name ?? null,
      highway: tags.highway,
      geometry: points.map((p) => [Number(p.lat.toFixed(6)), Number(p.lon.toFixed(6))]),
      elevation: points.map((p) => Math.round(elevation.get(p.id) * 10) / 10),
      length: Math.round(length * 10) / 10,
      surface: surfaceOf(tags),
      slopePercent: isSteps ? 0 : maxSlope(points, elevation),
      steps: isSteps ? Number(tags.step_count) || Math.max(3, Math.round(length / 0.3)) : 0,
      lit: tri(tags.lit),
      tactilePaving: tri(tags.tactile_paving),
      kerbRamps: tags.kerb === "lowered" || tags.kerb === "flush" ? true : tags.kerb === "raised" ? false : null,
    });
    graphNodes.add(points[0].id).add(points.at(-1).id);
    start = i;
  }
}

const nodes = [...graphNodes].map((id) => {
  const n = osmNodes.get(id);
  return [String(id), Number(n.lat.toFixed(6)), Number(n.lon.toFixed(6))];
});

await writeFile(
  OUT,
  JSON.stringify(
    {
      attribution: "© OpenStreetMap contributors, ODbL. Elevation: Copernicus DEM GLO-90 via Open-Meteo.",
      fetchedAt: new Date().toISOString().slice(0, 10),
      nodes,
      edges,
    },
    null,
    0,
  ) + "\n",
);
console.log(`Wrote ${nodes.length} graph nodes and ${edges.length} edges`);

const [south, west, north, east] = BBOX;
const placeElements = (await overpass(placesQuery)).elements;
const osmPlaces = placeElements
  .map((e) => ({ id: `${e.type[0]}${e.id}`, lat: e.center?.lat ?? e.lat, lng: e.center?.lon ?? e.lon, tags: e.tags }))
  .filter((p) => p.lat >= south && p.lat <= north && p.lng >= west && p.lng <= east)
  .map((p) => ({
    id: p.id,
    name: p.tags.name.trim(),
    lat: Number(p.lat.toFixed(6)),
    lng: Number(p.lng.toFixed(6)),
    tags: Object.fromEntries(PLACE_TAGS.filter((t) => p.tags[t]).map((t) => [t, p.tags[t]])),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
await writeFile(PLACES_OUT, JSON.stringify(osmPlaces, null, 1) + "\n");
console.log(`Wrote ${osmPlaces.length} named places`);
