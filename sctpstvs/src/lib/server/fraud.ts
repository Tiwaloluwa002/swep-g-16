import type { Db } from "@/lib/server/db";
import type { FraudEvent, FraudKind } from "@/lib/types";

export interface FraudInput {
  kind: FraudKind;
  ticketId?: string | null;
  actorId?: number | null;
  vehicle?: string | null;
  ip?: string | null;
  detail?: string | null;
  now?: number;
}

export function logFraud(db: Db, e: FraudInput): void {
  db.prepare(
    "INSERT INTO fraud_log (at, kind, ticket_id, actor_id, vehicle, ip, detail) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    e.now ?? Date.now(),
    e.kind,
    e.ticketId ?? null,
    e.actorId ?? null,
    e.vehicle ?? null,
    e.ip ?? null,
    e.detail?.slice(0, 300) ?? null,
  );
}

export function listFraud(db: Db, { kind, limit = 200 }: { kind?: FraudKind; limit?: number } = {}): FraudEvent[] {
  const rows = db
    .prepare(
      `SELECT f.id, f.at, f.kind, f.ticket_id, u.name AS actor_name, f.vehicle, f.ip, f.detail
       FROM fraud_log f LEFT JOIN users u ON u.id = f.actor_id
       WHERE (? IS NULL OR f.kind = ?) ORDER BY f.id DESC LIMIT ?`,
    )
    .all(kind ?? null, kind ?? null, limit) as {
    id: number;
    at: number;
    kind: FraudKind;
    ticket_id: string | null;
    actor_name: string | null;
    vehicle: string | null;
    ip: string | null;
    detail: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    kind: r.kind,
    ticketId: r.ticket_id,
    actorName: r.actor_name,
    vehicle: r.vehicle,
    ip: r.ip,
    detail: r.detail,
  }));
}
