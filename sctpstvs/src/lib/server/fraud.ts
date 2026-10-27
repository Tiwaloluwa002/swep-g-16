import { type Db, ms, ts } from "@/lib/server/db";
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

export async function logFraud(db: Db, e: FraudInput): Promise<void> {
  await db.query(
    "INSERT INTO {schema}.fraud_log (at, kind, ticket_id, actor_id, vehicle, ip, detail) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [
      ts(e.now ?? Date.now()),
      e.kind,
      e.ticketId ?? null,
      e.actorId ?? null,
      e.vehicle ?? null,
      e.ip ?? null,
      e.detail?.slice(0, 300) ?? null,
    ],
  );
}

export async function listFraud(
  db: Db,
  { kind, limit = 200 }: { kind?: FraudKind; limit?: number } = {},
): Promise<FraudEvent[]> {
  const rows = await db.query<{
    id: number;
    at: Date;
    kind: FraudKind;
    ticket_id: string | null;
    actor_name: string | null;
    vehicle: string | null;
    ip: string | null;
    detail: string | null;
  }>(
    `SELECT f.id, f.at, f.kind, f.ticket_id, u.name AS actor_name, f.vehicle, f.ip, f.detail
     FROM {schema}.fraud_log f LEFT JOIN {schema}.users u ON u.id = f.actor_id
     WHERE ($1::text IS NULL OR f.kind = $1) ORDER BY f.id DESC LIMIT $2`,
    [kind ?? null, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    at: ms(r.at),
    kind: r.kind,
    ticketId: r.ticket_id,
    actorName: r.actor_name,
    vehicle: r.vehicle,
    ip: r.ip,
    detail: r.detail,
  }));
}
