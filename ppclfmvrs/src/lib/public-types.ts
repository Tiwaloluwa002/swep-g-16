import type { Category, ClaimStatus, Custody, FoundStatus, LostStatus, PrivateDetails, Role, ScoreBreakdown } from "./types";

/*
 * The only shapes the API sends to browsers. They are built field by field
 * in src/lib/server/serialize.ts, so a new database column never leaks by
 * accident.
 */

export type PublicFound = {
  id: string;
  category: Category;
  colour: string;
  locationId: string;
  locationName: string;
  foundDate: string;
  description: string;
  custody: Custody;
  status: FoundStatus;
  createdAt: string;
};

export type PublicLost = {
  id: string;
  category: Category;
  colour: string;
  brand: string;
  description: string;
  locationId: string;
  locationName: string;
  lostDate: string;
  timeFrom: string;
  timeTo: string;
  status: LostStatus;
  createdAt: string;
};

/** The owner's own report: the only response that may carry private details. */
export type OwnLost = PublicLost & { privateDetails: PrivateDetails };

/** Where and how the handover happens. Shown only to the two parties after verification. */
export type HandoverInfo = {
  place: string;
  instructions: string;
};

/** The finder's own report: question texts but never the answers. */
export type OwnFound = PublicFound & {
  questions: string[];
  deskName: string | null;
  meetLocationName: string | null;
  receivedAt: string | null;
  /** Present once an owner has been verified, until the handover. */
  pendingHandover: HandoverInfo | null;
};

export type Candidate = {
  score: number;
  breakdown: ScoreBreakdown;
  found: PublicFound;
  /** The caller's existing claim on this item, if any. */
  claimId: string | null;
};

export type ClaimView = {
  id: string;
  status: ClaimStatus;
  attemptsLeft: number;
  questions: string[];
  lost: PublicLost;
  found: PublicFound;
  handover: (HandoverInfo & { codeExpiresAt: string | null }) | null;
};

export type SessionUser = {
  id: string;
  ident: string;
  name: string;
  role: Role;
  deskName: string | null;
};

export type DeskItem = PublicFound & {
  deskName: string | null;
  receivedAt: string | null;
  /** Code expiry of a verified claim waiting for collection. */
  awaitingCollectionUntil: string | null;
};

export type FailedAttempt = {
  id: string;
  createdAt: string;
  claimantIdent: string;
  claimId: string;
  itemSummary: string;
  claimLocked: boolean;
};

export type Stats = {
  lostReported: number;
  foundReported: number;
  matched: number;
  verified: number;
  recovered: number;
  failedAttempts: number;
};
