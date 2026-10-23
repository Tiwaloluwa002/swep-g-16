import type { FraudKind, LedgerKind, TicketStatus } from "@/lib/types";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  active: "Active",
  redeemed: "Used",
  expired: "Expired",
  refunded: "Refunded",
};

export const LEDGER_LABELS: Record<LedgerKind, string> = {
  topup: "Top-up",
  purchase: "Ticket purchase",
  refund: "Refund",
};

export const FRAUD_LABELS: Record<FraudKind, string> = {
  bad_format: "Malformed code",
  bad_signature: "Invalid signature",
  unknown_code: "Unknown backup code",
  reuse: "Reuse attempt",
  expired: "Expired ticket",
  wrong_route: "Wrong route",
  refunded: "Refunded ticket",
  rate_limit_verify: "Verify rate limit hit",
  rate_limit_login: "Login rate limit hit",
};
