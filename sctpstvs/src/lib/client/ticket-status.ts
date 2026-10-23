import type { Ticket, TicketStatus } from "@/lib/types";

/** The server's status can go stale while a page is open; an active ticket past its expiry is expired. */
export function liveStatus(ticket: Ticket, now: number): TicketStatus {
  return ticket.status === "active" && now > 0 && ticket.expiresAt <= now ? "expired" : ticket.status;
}
