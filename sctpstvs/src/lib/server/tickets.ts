import { type Db, ms, msOrNull, ts } from "@/lib/server/db";
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
  issued_at: Date;
  expires_at: Date;
  status: "active" | "redeemed" | "refunded";
  redeemed_at: Date | null;
  redeemed_by: number | null;
  redeemed_vehicle: string | null;
  holder_matric: string;
  holder_name: string;
  redeemed_by_name: string | null;
}

const SELECT_TICKET = `
  SELECT t.*, r.name AS route_name, u.matric AS holder_matric, u.name AS holder_name, c.name AS redeemed_by_name
  FROM {schema}.tickets t
  JOIN {schema}.routes r ON r.id = t.route_id
  JOIN {schema}.users u ON u.id = t.user_id
  LEFT JOIN {schema}.users c ON c.id = t.redeemed_by`;

function statusOf(r: TicketRow, now: number): TicketStatus {
  if (r.status === "active" && ms(r.expires_at) <= now) return "expired";
  return r.status;
}

function toTicket(r: TicketRow, now: number): Ticket {
  return {
    id: r.id,
    shortCode: formatShortCode(r.short_code),
    routeId: r.route_id,
    routeName: r.route_name,
    fareKobo: r.fare_kobo,
    issuedAt: ms(r.issued_at),
    expiresAt: ms(r.expires_at),
    status: statusOf(r, now),
    redeemedAt: msOrNull(r.redeemed_at),
    redeemedVehicle: r.redeemed_vehicle,
  };
}

function findTicket(db: Db, where: "t.id" | "t.short_code", value: string): Promise<TicketRow | undefined> {
  return db.maybeOne<TicketRow>(`${SELECT_TICKET} WHERE ${where} = $1`, [value]);
}

/**
 * Buys a ticket from the wallet. The fare always comes from the route row in
 * the database; the caller can only choose which route. The balance check,
 * ledger debit and ticket insert share one transaction that first locks the
 * buyer's users row (SELECT … FOR NO KEY UPDATE). Another purchase, top-up or
 * refund for the same wallet waits for that lock, so two simultaneous
 * purchases cannot both spend the same naira, even on separate servers.
 */
export async function purchaseTicket(
  db: Db,
  keys: SigningKeys,
  userId: number,
  routeId: number,
  { now = Date.now(), ttlMs = ticketTtlMs() }: { now?: number; ttlMs?: number } = {},
): Promise<OwnTicket> {
  if (!Number.isSafeInteger(routeId)) throw new AppError("Choose a route.");
  const id = await db.transaction(async (tx) => {
    const owner = await tx.maybeOne("SELECT id FROM {schema}.users WHERE id = $1 FOR NO KEY UPDATE", [userId]);
    if (!owner) throw new AppError("Account not found.", 404);
    const route = await tx.maybeOne<{ id: number; fare_kobo: number; active: boolean }>(
      "SELECT id, fare_kobo, active FROM {schema}.routes WHERE id = $1",
      [routeId],
    );
    if (!route || !route.active) throw new AppError("That route is not available.", 404);

    const balance = await getBalance(tx, userId);
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
    // A short-code collision is astronomically unlikely, but retry rather than fail a paid purchase.
    // ON CONFLICT keeps the transaction usable (a failed INSERT would abort it).
    for (let attempt = 0; ; attempt++) {
      const inserted = await tx.query(
        `INSERT INTO {schema}.tickets (id, short_code, user_id, route_id, fare_kobo, token, issued_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (short_code) DO NOTHING RETURNING id`,
        [ticketId, newShortCode(), userId, route.id, route.fare_kobo, token, ts(now), ts(expiresAt)],
      );
      if (inserted.length) break;
      if (attempt >= 4) throw new Error("Could not allocate a unique backup code");
    }
    await tx.query(
      `INSERT INTO {schema}.ledger (user_id, kind, amount_kobo, ticket_id, note, created_at)
       VALUES ($1, 'purchase', $2, $3, 'Ticket purchase', $4)`,
      [userId, -route.fare_kobo, ticketId, ts(now)],
    );
    return ticketId;
  });
  const row = (await findTicket(db, "t.id", id))!;
  return { ...toTicket(row, now), token: row.token };
}

export async function listOwnTickets(db: Db, userId: number, now = Date.now()): Promise<OwnTicket[]> {
  const rows = await db.query<TicketRow>(`${SELECT_TICKET} WHERE t.user_id = $1 ORDER BY t.issued_at DESC LIMIT 100`, [
    userId,
  ]);
  return rows.map((r) => ({ ...toTicket(r, now), token: r.token }));
}

export interface TicketFilter {
  status?: TicketStatus;
  routeId?: number;
  q?: string;
}

export async function listAllTickets(db: Db, filter: TicketFilter = {}, now = Date.now()): Promise<AdminTicket[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  const arg = (value: unknown) => `$${args.push(value)}`;
  if (filter.status === "expired") {
    where.push(`t.status = 'active' AND t.expires_at <= ${arg(ts(now))}`);
  } else if (filter.status === "active") {
    where.push(`t.status = 'active' AND t.expires_at > ${arg(ts(now))}`);
  } else if (filter.status) {
    where.push(`t.status = ${arg(filter.status)}`);
  }
  if (filter.routeId) where.push(`t.route_id = ${arg(filter.routeId)}`);
  const q = filter.q?.trim();
  if (q) {
    const like = arg(`%${q}%`);
    where.push(`(t.id = ${arg(q)} OR t.short_code = ${arg(normaliseShortCode(q) ?? q)} OR u.matric ILIKE ${like} OR u.name ILIKE ${like})`);
  }
  const sql = `${SELECT_TICKET} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY t.issued_at DESC LIMIT 300`;
  return (await db.query<TicketRow>(sql, args)).map((r) => ({
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
    headline: `ALREADY USED at ${formatTime(msOrNull(r.redeemed_at) ?? now)}${where}`,
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
export async function verifyAndRedeem(
  db: Db,
  keys: SigningKeys,
  input: string,
  ctx: VerifyContext,
): Promise<VerifyResult> {
  const now = ctx.now ?? Date.now();
  const raw = input.trim();
  const log = (kind: Parameters<typeof logFraud>[1]["kind"], ticketId: string | null, detail: string) =>
    logFraud(db, { kind, ticketId, actorId: ctx.conductorId, vehicle: ctx.vehicle?.name, ip: ctx.ip, detail, now });
  const invalid = (detail: string): VerifyResult => ({ outcome: "invalid", headline: "INVALID", detail });

  let row: TicketRow | undefined;
  if (looksLikeToken(raw)) {
    const check = verifyTicketToken(raw, keys);
    if (!check.ok) {
      await log(check.reason, null, check.reason === "bad_format" ? "Malformed ticket code" : "Signature check failed");
      return invalid("This code was not issued by the campus transport system, or it has been altered.");
    }
    row = await findTicket(db, "t.id", check.claims.tid);
    if (!row || row.token !== raw) {
      await log("bad_signature", check.claims.tid, "Validly signed token with no matching ticket");
      return invalid("No matching ticket was found.");
    }
  } else {
    const code = normaliseShortCode(raw);
    if (!code) {
      await log("bad_format", null, "Unrecognised input");
      return invalid("That is neither a ticket QR code nor a 10-character backup code.");
    }
    row = await findTicket(db, "t.short_code", code);
    if (!row) {
      await log("unknown_code", null, `Backup code ${formatShortCode(code)}`);
      return invalid("No ticket has that backup code. Check it was typed correctly.");
    }
    // The stored token must still carry our signature, so an edited database row is caught too.
    if (!verifyTicketToken(row.token, keys).ok) {
      await log("bad_signature", row.id, "Stored token failed signature check");
      return invalid("This ticket's signature does not check out.");
    }
  }

  if (row.status === "refunded") {
    await log("refunded", row.id, "Refunded ticket presented");
    return { ...invalid("This ticket was refunded and can no longer be used."), ticket: summary(row, now) };
  }
  if (row.status === "redeemed") {
    await log("reuse", row.id, `First used at ${formatTime(msOrNull(row.redeemed_at) ?? now)} on ${row.redeemed_vehicle ?? "unknown vehicle"}`);
    return alreadyUsed(row, now);
  }
  if (ms(row.expires_at) <= now) {
    await log("expired", row.id, "Expired ticket presented");
    return {
      outcome: "expired",
      headline: "EXPIRED",
      detail: `This ticket expired at ${formatTime(ms(row.expires_at))}.`,
      ticket: summary(row, now),
      holderName: row.holder_name,
    };
  }
  const vehicle = ctx.vehicle;
  if (vehicle?.routeId && vehicle.routeId !== row.route_id) {
    await log("wrong_route", row.id, `Ticket for ${row.route_name}, vehicle on ${vehicle.routeName}`);
    return {
      outcome: "wrong_route",
      headline: "WRONG ROUTE",
      detail: `Ticket is for ${row.route_name}; ${vehicle.name} runs ${vehicle.routeName}. The ticket was not used up.`,
      ticket: summary(row, now),
      holderName: row.holder_name,
    };
  }

  // The single-use guarantee: one conditional UPDATE. Postgres row-locks the
  // ticket while updating it; a concurrent UPDATE waits, then re-checks the
  // WHERE clause against the committed row (status is no longer 'active'), so
  // it changes nothing. Exactly one caller gets a row back.
  const redeemed = await db.query(
    `UPDATE {schema}.tickets SET status = 'redeemed', redeemed_at = $1, redeemed_by = $2, redeemed_vehicle = $3
     WHERE id = $4 AND status = 'active' AND expires_at > $1
     RETURNING id`,
    [ts(now), ctx.conductorId, vehicle?.name ?? null, row.id],
  );
  const fresh = (await findTicket(db, "t.id", row.id))!;
  if (redeemed.length === 0) {
    // Someone else redeemed or refunded it between our read and our write.
    if (fresh.status === "redeemed") {
      await log("reuse", fresh.id, "Lost a simultaneous redemption race");
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
export async function refundTicket(db: Db, ticketId: string, adminId: number, now = Date.now()): Promise<Ticket> {
  await db.transaction(async (tx) => {
    // Locking the ticket row means a concurrent redemption or second refund waits, then sees the new status.
    const t = await tx.maybeOne<{ user_id: number; fare_kobo: number; status: string }>(
      "SELECT user_id, fare_kobo, status FROM {schema}.tickets WHERE id = $1 FOR UPDATE",
      [ticketId],
    );
    if (!t) throw new AppError("Ticket not found.", 404);
    if (t.status !== "active") throw new AppError("Only unused tickets can be refunded.", 409);
    await tx.query("UPDATE {schema}.tickets SET status = 'refunded' WHERE id = $1 AND status = 'active'", [ticketId]);
    await tx.query(
      `INSERT INTO {schema}.ledger (user_id, kind, amount_kobo, ticket_id, note, created_by, created_at)
       VALUES ($1, 'refund', $2, $3, 'Ticket refunded by admin', $4, $5)`,
      [t.user_id, t.fare_kobo, ticketId, adminId, ts(now)],
    );
  });
  return toTicket((await findTicket(db, "t.id", ticketId))!, now);
}
