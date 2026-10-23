export type Role = "member" | "desk" | "admin";

export type Category = "phone" | "id-card" | "wallet" | "keys" | "laptop" | "bag" | "earphones" | "book" | "other";

export type Custody = "desk" | "finder";

export type LostStatus = "open" | "recovered" | "closed";

/** "pending_handover": an owner has proved ownership and the item is waiting to be collected. */
export type FoundStatus = "open" | "pending_handover" | "recovered" | "closed";

/** "locked": too many wrong answers; "completed": handed over. */
export type ClaimStatus = "open" | "verified" | "locked" | "completed" | "cancelled";

/** Identifying details only the owner knows. Stored server-side and never returned publicly. */
export type PrivateDetails = {
  serialLastDigits?: string;
  lockScreen?: string;
  contents?: string;
  uniqueMarks?: string;
};

export type User = {
  id: string;
  ident: string;
  name: string;
  role: Role;
  deskId: string | null;
  phone: string | null;
  email: string | null;
  passwordHash: string;
  createdAt: string;
};

export type LostItem = {
  id: string;
  ownerId: string;
  category: Category;
  colour: string;
  brand: string;
  description: string;
  locationId: string;
  lostDate: string;
  timeFrom: string;
  timeTo: string;
  privateDetails: PrivateDetails;
  status: LostStatus;
  createdAt: string;
  updatedAt: string;
};

export type FoundItem = {
  id: string;
  finderId: string;
  category: Category;
  colour: string;
  locationId: string;
  foundDate: string;
  description: string;
  custody: Custody;
  /** Collection desk for desk custody. */
  deskId: string | null;
  /** Public meeting point for finder custody. */
  meetLocationId: string | null;
  receivedAt: string | null;
  status: FoundStatus;
  createdAt: string;
  updatedAt: string;
};

export type VerificationQuestion = {
  id: string;
  foundId: string;
  position: number;
  question: string;
  salt: string;
  answerHash: string;
};

export type Claim = {
  id: string;
  lostId: string;
  foundId: string;
  claimantId: string;
  status: ClaimStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

export type ScoreBreakdown = {
  colour: number;
  location: number;
  date: number;
  keywords: number;
};

export type MatchScore = {
  score: number;
  breakdown: ScoreBreakdown;
};

export type Notification = {
  id: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};
