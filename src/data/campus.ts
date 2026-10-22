import { createGraph } from "@/lib/graph";
import type { CampusEdge, CampusNode, PlaceAccessibility, PlaceInput, RestPointInput } from "@/lib/types";
import osm from "./osm-network.json";

/*
 * OAU Ile-Ife campus walking network.
 *
 * Paths come from OpenStreetMap (`npm run import:osm` refreshes them) and
 * slopes are estimated from a 90 m terrain model. Building positions are
 * from OpenStreetMap too. Building accessibility features start as null
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

const place = (
  id: string,
  name: string,
  category: PlaceInput["category"],
  lat: number,
  lng: number,
  description: string,
  accessibility: Partial<PlaceAccessibility> = {},
): PlaceInput => ({ id, name, category, lat, lng, description, accessibility: { ...notSurveyed, ...accessibility } });

export const places: PlaceInput[] = [
  place("senate", "University Senate Building", "admin", 7.51865, 4.52349, "University administration and registry."),
  place("library", "Hezekiah Oluwasanmi Library", "library", 7.51984, 4.52305, "Main university library."),
  place("amphitheatre", "Amphitheatre", "student-life", 7.51924, 4.52213, "Open-air venue for events and gatherings."),
  place("oduduwa", "Oduduwa Hall", "student-life", 7.5188, 4.52203, "Main auditorium for convocations and large events."),
  place("sub", "Student Union Building (SUB)", "student-life", 7.51785, 4.52137, "Student union offices, eateries and shops."),
  place("arts", "Faculty of Arts", "academic", 7.51974, 4.5241, "Arts departments, AUD I and AUD II lecture theatres."),
  place("social-sciences", "Faculty of Social Sciences", "academic", 7.5213, 4.52269, "Social science departments."),
  place("law", "Faculty of Law", "academic", 7.52094, 4.52237, "Law faculty."),
  place("education", "Faculty of Education", "academic", 7.52074, 4.5236, "Education faculty."),
  place("administration", "Faculty of Administration", "academic", 7.52053, 4.52231, "Administration faculty."),
  place("first-bank-lt", "First Bank Lecture Theatre", "academic", 7.52179, 4.5239, "Large lecture theatre."),
  place("hslt", "Humanities Lecture Theatres (HSLT)", "academic", 7.51672, 4.52491, "HSLT A, B and C lecture theatres."),
  place("technology", "Faculty of Technology", "academic", 7.51786, 4.52831, "Engineering departments and lecture theatres."),
  place("central-science-lab", "Central Science Laboratory", "academic", 7.52022, 4.52753, "Shared science laboratories."),
  place("pharmacy", "Faculty of Pharmacy", "academic", 7.51676, 4.52713, "Pharmacy faculty."),
  place("1000-seater", "1000 Seater Lecture Theatre", "academic", 7.52084, 4.51965, "Large lecture theatre."),
  place("health-centre", "OAU Health Centre", "health", 7.52027, 4.51636, "Campus clinic and emergency care."),
  place("sports-centre", "OAU Sports Centre", "student-life", 7.51525, 4.52095, "Sports centre and main bowl."),
  place("banks", "Banking area", "student-life", 7.51462, 4.52335, "Campus banks and ATMs."),
  place("moremi", "Moremi Hall", "hall", 7.51965, 4.5186, "Hall of residence."),
  place("fajuyi", "Adekunle Fajuyi Hall", "hall", 7.51735, 4.51774, "Hall of residence."),
  place("awolowo", "Awolowo Hall", "hall", 7.52058, 4.51472, "Hall of residence."),
  place("etf", "ETF Hall", "hall", 7.51828, 4.51466, "Hall of residence."),
  place("alumni", "Alumni Hall", "hall", 7.52161, 4.51718, "Hall of residence."),
  place("mozambique", "Mozambique Hall", "hall", 7.52286, 4.51413, "Hall of residence."),
  place("angola", "Angola Hall", "hall", 7.5218, 4.51247, "Hall of residence."),
  place("postgraduate-hall", "Postgraduate Hall", "hall", 7.52271, 4.51647, "Postgraduate hall of residence."),
];

/** Benches and shelters found during the survey. */
const restPoints: RestPointInput[] = [];

export const campus = createGraph(nodes, edges, places, restPoints);
