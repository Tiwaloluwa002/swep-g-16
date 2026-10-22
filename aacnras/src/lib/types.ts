export type LatLng = { lat: number; lng: number };

export type Surface = "paved" | "rough" | "unpaved";

/** A junction or end point on the walking network. */
export type CampusNode = LatLng & {
  id: string;
  /** Present when there is somewhere to sit or shelter at this point. */
  restPoint?: string;
};

/**
 * A walkable segment between two nodes. Edges are two-way.
 * For tri-state fields, null means "not yet recorded".
 */
export type CampusEdge = {
  id: string;
  from: string;
  to: string;
  name: string | null;
  /** OpenStreetMap highway type: footway, steps, tertiary, service… */
  highway: string;
  /** [lat, lng] points from `from` to `to`. */
  geometry: [number, number][];
  /** Metres. */
  length: number;
  /** Terrain elevation in metres at each geometry point. */
  elevation: number[];
  surface: Surface;
  /** Steepest gradient along the segment, in percent (8 ≈ 1:12 ramp limit). */
  slopePercent: number;
  /** Number of steps; 0 means the segment is step-free. */
  steps: number;
  lit: boolean | null;
  tactilePaving: boolean | null;
  /** Dropped kerbs wherever the path meets a road. */
  kerbRamps: boolean | null;
};

export type PlaceCategory =
  | "admin"
  | "academic"
  | "library"
  | "hall"
  | "health"
  | "student-life"
  | "transport"
  | "bank"
  | "food"
  | "worship"
  | "parking"
  | "sports"
  | "other";

/** null means the feature has not been surveyed yet. */
export type PlaceAccessibility = {
  stepFreeEntrance: boolean | null;
  ramp: boolean | null;
  lift: boolean | null;
  accessibleToilet: boolean | null;
  notes?: string;
};

export type PlaceInput = LatLng & {
  id: string;
  name: string;
  category: PlaceCategory;
  description: string;
  accessibility: PlaceAccessibility;
  /** Departments, offices or facilities inside, from the survey. */
  inside?: string[];
  /** OpenStreetMap features this place is drawn from; the first supplies details. */
  osmIds?: string[];
  /** Selected OpenStreetMap tags: opening_hours, building:levels, wheelchair, phone… */
  osmTags?: Record<string, string>;
};

export type Place = PlaceInput & {
  /** The network node routes start and end at, nearest the building. */
  nodeId: string;
};

export type RestPointInput = LatLng & { name: string };

export type ProfileId =
  | "standard"
  | "wheelchair"
  | "visually-impaired"
  | "limited-mobility";

export type MobilityProfile = {
  id: ProfileId;
  label: string;
  description: string;
  /** Typical walking/rolling speed on flat paved ground, metres per second. */
  speed: number;
  allowSteps: boolean;
  /** Segments steeper than this are never used. */
  maxSlopePercent: number;
  /** Extra cost per step, in seconds, when steps are allowed. */
  stepPenalty: number;
  /** Time taken per step, for travel-time estimates. */
  secondsPerStep: number;
  /** Multiplier applied per percent of slope (cost grows with gradient). */
  slopeFactor: number;
  surfacePenalty: Record<Surface, number>;
  /** Multiplier for segments with no dropped kerbs. */
  noKerbRampPenalty: number;
  /** Multiplier for segments without tactile paving. */
  noTactilePenalty: number;
  /** Multiplier for main roads shared with traffic. */
  busyRoadPenalty: number;
};

export type ReportType =
  | "blocked"
  | "construction"
  | "flooding"
  | "broken-lift"
  | "broken-ramp"
  | "other";

export type ReportStatus = "pending" | "verified" | "rejected" | "resolved";

export type Report = {
  id: string;
  type: ReportType;
  description: string;
  /** A path segment the report is about, if any. */
  edgeId?: string;
  /** A building the report is about, if any. */
  placeId?: string;
  lat: number;
  lng: number;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
};

export type RouteOptions = {
  profile: ProfileId;
  /** Prefer lit paths (after dark). */
  avoidUnlit: boolean;
};

export type RouteStep = {
  instruction: string;
  distance: number;
  edgeIds: string[];
  warnings: string[];
};

export type RouteResult = {
  nodeIds: string[];
  edgeIds: string[];
  distance: number;
  /** Estimated travel time in seconds for the chosen profile. */
  duration: number;
  steps: RouteStep[];
  /** Route-wide advisories, e.g. pending obstacle reports. */
  advisories: string[];
  restPoints: string[];
};
