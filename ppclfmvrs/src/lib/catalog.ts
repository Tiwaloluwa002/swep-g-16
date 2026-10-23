import type { Category } from "./types";

export const CATEGORIES: Record<Category, string> = {
  phone: "Phone",
  "id-card": "ID card",
  wallet: "Wallet or purse",
  keys: "Keys",
  laptop: "Laptop or tablet",
  bag: "Bag or backpack",
  earphones: "Earphones or headphones",
  book: "Book or notes",
  other: "Other",
};

export const COLOURS = [
  "black",
  "grey",
  "silver",
  "white",
  "beige",
  "brown",
  "gold",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
  "blue",
  "navy",
  "green",
  "multicolour",
] as const;

/** Colours people often confuse with each other when describing an item. */
export const SIMILAR_COLOURS: [string, string][] = [
  ["black", "grey"],
  ["black", "navy"],
  ["grey", "silver"],
  ["silver", "white"],
  ["white", "beige"],
  ["beige", "brown"],
  ["gold", "yellow"],
  ["yellow", "orange"],
  ["orange", "red"],
  ["red", "pink"],
  ["pink", "purple"],
  ["purple", "blue"],
  ["blue", "navy"],
  ["blue", "green"],
];

export type CampusLocation = { id: string; name: string; lat: number; lng: number };

/*
 * Coordinates come from OpenStreetMap (the same import used by aacnras).
 * Proximity between locations is computed from them, so "nearby" needs no
 * hand-made grouping.
 */
export const LOCATIONS: CampusLocation[] = [
  { id: "senate", name: "Senate Building", lat: 7.518612, lng: 4.524093 },
  { id: "library", name: "Hezekiah Oluwasanmi Library", lat: 7.519842, lng: 4.523048 },
  { id: "sub", name: "Student Union Building (SUB)", lat: 7.517848, lng: 4.521369 },
  { id: "oduduwa", name: "Oduduwa Hall", lat: 7.518797, lng: 4.522027 },
  { id: "amphi", name: "Amphitheatre", lat: 7.519244, lng: 4.522131 },
  { id: "tech", name: "Faculty of Technology", lat: 7.517855, lng: 4.528308 },
  { id: "science", name: "Central Science Laboratory", lat: 7.520222, lng: 4.527528 },
  { id: "arts", name: "Faculty of Arts", lat: 7.51974, lng: 4.524105 },
  { id: "education", name: "Faculty of Education", lat: 7.520738, lng: 4.523597 },
  { id: "law", name: "Faculty of Law", lat: 7.52094, lng: 4.522366 },
  { id: "social", name: "Faculty of Social Sciences", lat: 7.521303, lng: 4.522688 },
  { id: "administration", name: "Faculty of Administration", lat: 7.520533, lng: 4.522312 },
  { id: "pharmacy", name: "Faculty of Pharmacy", lat: 7.51676, lng: 4.527125 },
  { id: "edm", name: "Faculty of Environmental Design and Management", lat: 7.515827, lng: 4.527308 },
  { id: "1000-seater", name: "1000 Seater Lecture Theatre", lat: 7.520842, lng: 4.519649 },
  { id: "banks", name: "Banks (First Bank, GTBank, Zenith, Wema)", lat: 7.5148, lng: 4.5233 },
  { id: "sports", name: "Sports Centre", lat: 7.515249, lng: 4.520952 },
  { id: "health", name: "Health Centre", lat: 7.520267, lng: 4.516363 },
  { id: "moremi", name: "Moremi Hall", lat: 7.519648, lng: 4.518596 },
  { id: "fajuyi", name: "Fajuyi Hall", lat: 7.517349, lng: 4.517744 },
  { id: "awolowo", name: "Awolowo Hall", lat: 7.520576, lng: 4.514717 },
  { id: "etf", name: "ETF Hall", lat: 7.518282, lng: 4.51466 },
  { id: "angola", name: "Angola Hall", lat: 7.5218, lng: 4.512473 },
  { id: "mozambique", name: "Mozambique Hall", lat: 7.522862, lng: 4.514133 },
  { id: "alumni", name: "Alumni Hall", lat: 7.521613, lng: 4.517177 },
  { id: "postgraduate", name: "Postgraduate Hall", lat: 7.522707, lng: 4.516471 },
];

const LOCATION_BY_ID = new Map(LOCATIONS.map((l) => [l.id, l]));

export function getLocation(id: string): CampusLocation | undefined {
  return LOCATION_BY_ID.get(id);
}

export function locationName(id: string | null | undefined): string {
  return (id && LOCATION_BY_ID.get(id)?.name) || "Unknown place";
}

export type Desk = { id: string; name: string; locationId: string; hours: string };

export const DESKS: Desk[] = [
  { id: "security", name: "Security Unit desk", locationId: "senate", hours: "Mon–Sat, 8am–6pm" },
  { id: "sub", name: "SUB information desk", locationId: "sub", hours: "Mon–Fri, 9am–5pm" },
];

export function getDesk(id: string | null | undefined): Desk | undefined {
  return DESKS.find((d) => d.id === id);
}

/** Great-circle distance in metres. */
export function distanceMetres(a: CampusLocation, b: CampusLocation): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && value in CATEGORIES;
}

export function isColour(value: unknown): value is (typeof COLOURS)[number] {
  return typeof value === "string" && (COLOURS as readonly string[]).includes(value);
}
