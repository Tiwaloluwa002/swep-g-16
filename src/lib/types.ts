export type LatLng = { lat: number; lng: number };

export type Surface = "paved" | "rough" | "unpaved";

/** A point on the walking network: a building entrance or a path junction. */
export type CampusNode = LatLng & {
  id: string;
  /** Present when there is somewhere to sit or shelter at this point. */
  restPoint?: string;
};

/** A walkable segment between two nodes. Edges are two-way. */
export type CampusEdge = {
  id: string;
  from: string;
  to: string;
  name: string;
  surface: Surface;
  /** Steepest gradient along the segment, in percent (8 ≈ 1:12 ramp limit). */
  slopePercent: number;
  /** Number of steps; 0 means the segment is step-free. */
  steps: number;
  lit: boolean;
  shaded: boolean;
  tactilePaving: boolean;
  /** Dropped kerbs wherever the path meets a road. */
  kerbRamps: boolean;
};

export type PlaceCategory =
  | "admin"
  | "academic"
  | "library"
  | "hall"
  | "health"
  | "student-life"
  | "transport";

export type PlaceAccessibility = {
  stepFreeEntrance: boolean;
  ramp: boolean;
  lift: boolean;
  accessibleToilet: boolean;
  notes?: string;
};

export type Place = {
  id: string;
  name: string;
  category: PlaceCategory;
  /** The network node at the place's main accessible entrance. */
  nodeId: string;
  description: string;
  accessibility: PlaceAccessibility;
};

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
