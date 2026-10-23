export type Role = "student" | "conductor" | "admin";

export interface SessionUser {
  id: number;
  matric: string;
  name: string;
  role: Role;
}

export interface Route {
  id: number;
  name: string;
  origin: string;
  destination: string;
  fareKobo: number;
  active: boolean;
}

export interface Vehicle {
  id: number;
  name: string;
  routeId: number | null;
  routeName: string | null;
}

export type LedgerKind = "topup" | "purchase" | "refund";

export interface LedgerEntry {
  id: number;
  kind: LedgerKind;
  amountKobo: number;
  note: string | null;
  ticketId: string | null;
  createdAt: number;
}

/** "expired" is derived: an unused ticket whose expiry has passed. */
export type TicketStatus = "active" | "redeemed" | "expired" | "refunded";

export interface Ticket {
  id: string;
  shortCode: string;
  routeId: number;
  routeName: string;
  fareKobo: number;
  issuedAt: number;
  expiresAt: number;
  status: TicketStatus;
  redeemedAt: number | null;
  redeemedVehicle: string | null;
}

/** What the owner sees: includes the signed token for the QR code. */
export interface OwnTicket extends Ticket {
  token: string;
}

/** What admins see in the ticket list. */
export interface AdminTicket extends Ticket {
  holderMatric: string;
  holderName: string;
  redeemedByName: string | null;
}

export type VerifyOutcome = "valid" | "already_used" | "expired" | "wrong_route" | "invalid";

export interface VerifyResult {
  outcome: VerifyOutcome;
  /** One line a conductor can read at a glance, e.g. "ALREADY USED at 10:42 on Bus 3". */
  headline: string;
  detail: string;
  ticket?: Pick<Ticket, "id" | "shortCode" | "routeName" | "expiresAt" | "redeemedAt" | "redeemedVehicle">;
  holderName?: string;
}

export type FraudKind =
  | "bad_format"
  | "bad_signature"
  | "unknown_code"
  | "reuse"
  | "expired"
  | "wrong_route"
  | "refunded"
  | "rate_limit_verify"
  | "rate_limit_login";

export interface FraudEvent {
  id: number;
  at: number;
  kind: FraudKind;
  ticketId: string | null;
  actorName: string | null;
  vehicle: string | null;
  ip: string | null;
  detail: string | null;
}

export interface RouteStats {
  routeId: number;
  routeName: string;
  sold: number;
  redeemed: number;
  revenueKobo: number;
}

export interface AdminStats {
  ticketsSold: number;
  salesKobo: number;
  refundsKobo: number;
  redeemed: number;
  active: number;
  expiredUnused: number;
  topUpsKobo: number;
  walletFloatKobo: number;
  fraudLast24h: number;
  fraudByKind: Partial<Record<FraudKind, number>>;
  byRoute: RouteStats[];
}

export interface StudentWallet {
  userId: number;
  matric: string;
  name: string;
  balanceKobo: number;
}
