import { type Db, transaction } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import { logFraud } from "@/lib/server/fraud";
import type { SigningKeys } from "@/lib/server/keys";
import {
  formatShortCode,
  looksLikeToken,
  newShortCode,
  newTicketId,
  normaliseShortCode,
  signTicket,
  verifyTicketToken,
} from "@/lib/server/tokens";
import { getBalance } from "@/lib/server/wallet";
import { formatNaira } from "@/lib/money";
import { formatTime } from "@/lib/time";
import type { AdminTicket, OwnTicket, Ticket, TicketStatus, VerifyResult } from "@/lib/types";

const DEFAULT_TTL_MINUTES = 120;

/** How long a ticket stays valid after purchase; set TICKET_TTL_MINUTES to change it. */
export function ticketTtlMs(): number {
  const minutes = Number(process.env.TICKET_TTL_MINUTES);
  return (Number.isInteger(minutes) && minutes > 0 ? minutes : DEFAULT_TTL_MINUTES) * 60_000;
}

interface TicketRow {
  id: string;
  short_code: string;
  user_id: number;
  route_id: number;
  route_name: string;
  fare_kobo: number;
  token: string;
  issued_at: number;
  expires_at: number;
  status: "active" | "redeemed" | "refunded";
  redeemed_at: number | null;
  redeemed_by: number | null;
  redeemed_vehicle: string | null;
  holder_matric: string;
  holder_name: string;
  redeemed_by_name: string | null;
}

const SELECT_TICKET = `
  SELECT t.*, r.name AS route_name, u.matric AS holder_matric, u.name AS holder_name, c.name AS redeemed_by_name
  FROM tickets t
  JOIN routes r ON r.id = t.route_id
  JOIN users u ON u.id = t.user_id
  LEFT JOIN users c ON c.id = t.redeemed_by`;

function statusOf(r: TicketRow, now: number): TicketStatus {
  if (r.status === "active" && r.expires_at <= now) return "expired";
  return r.status;
}

function toTicket(r: TicketRow, now: number): Ticket {
  return {
    id: r.id,
    shortCode: formatShortCode(r.short_code),
    routeId: r.route_id,
    routeName: r.route_name,
    fareKobo: r.fare_kobo,
    issuedAt: r.issued_at,
    expiresAt: r.expires_at,
    status: statusOf(r, now),
    redeemedAt: r.redeemed_at,
    redeemedVehicle: r.redeemed_vehicle,
  };
}

function findTicket(db: Db, where: "t.id" | "t.short_code", value: string): TicketRow | undefined {
  return db.prepare(`${SELECT_TICKET} WHERE ${where} = ?`).get(value) as TicketRow | undefined;
}

/**
 * Buys a ticket from the wallet. The fare always comes from the route row in
 * the database; the caller can only choose which route. The balance check,
 * ledger debit and ticket insert share one write transaction, so two
 * simultaneous purchases cannot both spend the same naira.
 */
export function purchaseTicket(
  db: Db,
  keys: SigningKeys,
  userId: number,
  routeId: number,
  { now = Date.now(), ttlMs = ticketTtlMs() }: { now?: number; ttlMs?: number } = {},
): OwnTicket {
  if (!Number.isInteger(routeId)) throw new AppError("Choose a route.");
  const id = transaction(db, () => {
    const route = db.prepare("SELECT id, fare_kobo, active FROM routes WHERE id = ?").get(routeId) as
      | { id: number; fare_kobo: number; active: number }
      | undefined;
    if (!route || route.active !== 1) throw new AppError("That route is not available.", 404);

    const balance = getBalance(db, userId);
    if (balance < route.fare_kobo) {
      throw new AppError(
        `Insufficient funds: the fare is ${formatNaira(route.fare_kobo)} and your balance is ${formatNaira(balance)}.`,
        402,
      );
    }

    const ticketId = newTicketId();
    const expiresAt = now + ttlMs;
    const token = signTicket(
      { tid: ticketId, rid: route.id, iat: Math.floor(now / 1000), exp: Math.floor(expiresAt / 1000), kid: keys.keyId },
      keys,
    );
    const insert = db.prepare(
      `INSERT INTO tickets (id, short_code, user_id, route_id, fare_kobo, token, issued_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    // A short-code collision is astronomically unlikely, but retry rather than fail a paid purchase.
    for (let attempt = 0; ; attempt++) {
      try {
        insert.run(ticketId, newShortCode(), userId, route.id, route.fare_kobo, token, now, expiresAt);
        break;
      } catch (err) {
        if (attempt >= 4) throw err;
      }
    }
    db.prepare(
      "INSERT INTO ledger (user_id, kind, amount_kobo, ticket_id, note, created_at) VALUES (?, 'purchase', ?, ?, ?, ?)",
    ).run(userId, -route.fare_kobo, ticketId, "Ticket purchase", now);
    return ticketId;
  });
  const row = findTicket(db, "t.id", id)!;
  return { ...toTicket(row, now), token: row.token };
}

export function listOwnTickets(db: Db, userId: number, now = Date.now()): OwnTicket[] {
  const rows = db.prepare(`${SELECT_TICKET} WHERE t.user_id = ? ORDER BY t.issued_at DESC LIMIT 100`).all(userId);
  return (rows as unknown as TicketRow[]).map((r) => ({ ...toTicket(r, now), token: r.token }));
}

export interface TicketFilter {
  status?: TicketStatus;
  routeId?: number;
  q?: string;
}

export function listAllTickets(db: Db, filter: TicketFilter = {}, now = Date.now()): AdminTicket[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.status === "expired") {
    where.push("t.status = 'active' AND t.expires_at <= ?");
    args.push(now);
  } else if (filter.status === "active") {
    where.push("t.status = 'active' AND t.expires_at > ?");
    args.push(now);
  } else if (filter.status) {
    where.push("t.status = ?");
    args.push(filter.status);
  }
  if (filter.routeId) {
    where.push("t.route_id = ?");
    args.push(filter.routeId);
  }
  const q = filter.q?.trim();
  if (q) {
    where.push("(t.id = ? OR t.short_code = ? OR u.matric LIKE ? OR u.name LIKE ?)");
    args.push(q, normaliseShortCode(q) ?? q, `%${q}%`, `%${q}%`);
  }
  const sql = `${SELECT_TICKET} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY t.issued_at DESC LIMIT 300`;
  return (db.prepare(sql).all(...args) as unknown as TicketRow[]).map((r) => ({
    ...toTicket(r, now),
    holderMatric: r.holder_matric,
    holderName: r.holder_name,
    redeemedByName: r.redeemed_by_name,
  }));
}

export interface VerifyContext {
  conductorId: number;
  vehicle?: { name: string; routeId: number | null; routeName: string | null };
  ip?: string;
  now?: number;
}

function summary(r: TicketRow, now: number): VerifyResult["ticket"] {
  const t = toTicket(r, now);
  return {
    id: t.id,
    shortCode: t.shortCode,
    routeName: t.routeName,
    expiresAt: t.expiresAt,
    redeemedAt: t.redeemedAt,
    redeemedVehicle: t.redeemedVehicle,
  };
}

function alreadyUsed(r: TicketRow, now: number): VerifyResult {
  const where = r.redeemed_vehicle ? ` on ${r.redeemed_vehicle}` : "";
  return {
    outcome: "already_used",
    headline: `ALREADY USED at ${formatTime(r.redeemed_at ?? now)}${where}`,
    detail: `Checked by ${r.redeemed_by_name ?? "a conductor"}. Do not let this passenger board on this ticket.`,
    ticket: summary(r, now),
    holderName: r.holder_name,
  };
}

/**
 * Verifies a scanned token or typed backup code and, if it is good, marks the
 * ticket used. The final UPDATE only succeeds while the ticket is still
 * active and unexpired, so even if two conductors scan the same ticket at the
 * same instant, exactly one of them gets VALID.
 */
export function verifyAndRedeem(db: Db, keys: SigningKeys, input: string, ctx: VerifyContext): VerifyResult {
  const now = ctx.now ?? Date.now();
  const raw = input.trim();
  const log = (kind: Parameters<typeof logFraud>[1]["kind"], ticketId: string | null, detail: string) =>
    logFraud(db, { kind, ticketId, actorId: ctx.conductorId, vehicle: ctx.vehicle?.name, ip: ctx.ip, detail, now });
  const invalid = (detail: string): VerifyResult => ({ outcome: "invalid", headline: "INVALID", detail });

  let row: TicketRow | undefined;
  if (looksLikeToken(raw)) {
    const check = verifyTicketToken(raw, keys);
    if (!check.ok) {
      log(check.reason, null, check.reason === "bad_format" ? "Malformed ticket code" : "Signature check failed");
      return invalid("This code was not issued by the campus transport system, or it has been altered.");
    }
    row = findTicket(db, "t.id", check.claims.tid);
    if (!row || row.token !== raw) {
      log("bad_signature", check.claims.tid, "Validly signed token with no matching ticket");
      return invalid("No matching ticket was found.");
    }
  } else {
    const code = normaliseShortCode(raw);
    if (!code) {
      log("bad_format", null, "Unrecognised input");
      return invalid("That is neither a ticket QR code nor a 10-character backup code.");
    }
    row = findTicket(db, "t.short_code", code);
    if (!row) {
      log("unknown_code", null, `Backup code ${formatShortCode(code)}`);
      return invalid("No ticket has that backup code. Check it was typed correctly.");
    }
    // The stored token must still carry our signature, so an edited database row is caught too.
    if (!verifyTicketToken(row.token, keys).ok) {
      log("bad_signature", row.id, "Stored token failed signature check");
      return invalid("This ticket's signature does not check out.");
    }
  }

  if (row.status === "refunded") {
    log("refunded", row.id, "Refunded ticket presented");
    return { ...invalid("This ticket was refunded and can no longer be used."), ticket: summary(row, now) };
  }
  if (row.status === "redeemed") {
    log("reuse", row.id, `First used at ${formatTime(row.redeemed_at ?? now)} on ${row.redeemed_vehicle ?? "unknown vehicle"}`);
    return alreadyUsed(row, now);
  }
  if (row.expires_at <= now) {
    log("expired", row.id, "Expired ticket presented");
    return {
      outcome: "expired",
      headline: "EXPIRED",
      detail: `This ticket expired at ${formatTime(row.expires_at)}.`,
      ticket: summary(row, now),
      holderName: row.holder_name,
    };
  }
  const vehicle = ctx.vehicle;
  if (vehicle?.routeId && vehicle.routeId !== row.route_id) {
    log("wrong_route", row.id, `Ticket for ${row.route_name}, vehicle on ${vehicle.routeName}`);
    return {
      outcome: "wrong_route",
      headline: "WRONG ROUTE",
      detail: `Ticket is for ${row.route_name}; ${vehicle.name} runs ${vehicle.routeName}. The ticket was not used up.`,
      ticket: summary(row, now),
      holderName: row.holder_name,
    };
  }

  const { changes } = db
    .prepare(
      `UPDATE tickets SET status = 'redeemed', redeemed_at = ?, redeemed_by = ?, redeemed_vehicle = ?
       WHERE id = ? AND status = 'active' AND expires_at > ?`,
    )
    .run(now, ctx.conductorId, vehicle?.name ?? null, row.id, now);
  const fresh = findTicket(db, "t.id", row.id)!;
  if (changes === 0) {
    // Someone else redeemed or refunded it between our read and our write.
    if (fresh.status === "redeemed") {
      log("reuse", fresh.id, "Lost a simultaneous redemption race");
      return alreadyUsed(fresh, now);
    }
    return invalid("This ticket can no longer be used.");
  }
  return {
    outcome: "valid",
    headline: "VALID",
    detail: `${row.route_name} · let the passenger board.`,
    ticket: summary(fresh, now),
    holderName: fresh.holder_name,
  };
}

/** Refunds an unused ticket (active or expired) back to the holder's wallet. */
export function refundTicket(db: Db, ticketId: string, adminId: number, now = Date.now()): Ticket {
  transaction(db, () => {
    const t = db.prepare("SELECT user_id, fare_kobo, status FROM tickets WHERE id = ?").get(ticketId) as
      | { user_id: number; fare_kobo: number; status: string }
      | undefined;
    if (!t) throw new AppError("Ticket not found.", 404);
    if (t.status !== "active") throw new AppError("Only unused tickets can be refunded.", 409);
    db.prepare("UPDATE tickets SET status = 'refunded' WHERE id = ? AND status = 'active'").run(ticketId);
    db.prepare(
      `INSERT INTO ledger (user_id, kind, amount_kobo, ticket_id, note, created_by, created_at)
       VALUES (?, 'refund', ?, ?, 'Ticket refunded by admin', ?, ?)`,
    ).run(t.user_id, t.fare_kobo, ticketId, adminId, now);
  });
  return toTicket(findTicket(db, "t.id", ticketId)!, now);
}
