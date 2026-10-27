import { type Db, ms, ts } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import type { LedgerEntry, LedgerKind, StudentWallet } from "@/lib/types";

/** Largest single demo top-up or admin credit: ₦20,000. */
export const MAX_TOPUP_KOBO = 20_000 * 100;

export async function getBalance(db: Db, userId: number): Promise<number> {
  const r = await db.one<{ balance: number }>(
    "SELECT COALESCE(SUM(amount_kobo), 0)::bigint AS balance FROM {schema}.ledger WHERE user_id = $1",
    [userId],
  );
  return Number(r.balance);
}

export async function listLedger(db: Db, userId: number, limit = 50): Promise<LedgerEntry[]> {
  const rows = await db.query<{
    id: number;
    kind: LedgerKind;
    amount_kobo: number;
    note: string | null;
    ticket_id: string | null;
    created_at: Date;
  }>(
    `SELECT id, kind, amount_kobo, note, ticket_id, created_at FROM {schema}.ledger
     WHERE user_id = $1 ORDER BY id DESC LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    amountKobo: r.amount_kobo,
    note: r.note,
    ticketId: r.ticket_id,
    createdAt: ms(r.created_at),
  }));
}

/** Credits a student's wallet. Used by the demo top-up and by admin credits. */
export async function creditWallet(
  db: Db,
  userId: number,
  amountKobo: number,
  { note, createdBy, now = Date.now() }: { note: string; createdBy?: number; now?: number },
): Promise<number> {
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) throw new AppError("Enter a whole naira amount above zero.");
  if (amountKobo > MAX_TOPUP_KOBO) throw new AppError("A single credit cannot exceed ₦20,000.");
  return db.transaction(async (tx) => {
    // Same per-wallet lock as a purchase, so the returned balance is consistent.
    const user = await tx.maybeOne<{ role: string }>("SELECT role FROM {schema}.users WHERE id = $1 FOR NO KEY UPDATE", [
      userId,
    ]);
    if (!user) throw new AppError("Account not found.", 404);
    if (user.role !== "student") throw new AppError("Only student wallets can be credited.");
    await tx.query(
      "INSERT INTO {schema}.ledger (user_id, kind, amount_kobo, note, created_by, created_at) VALUES ($1, 'topup', $2, $3, $4, $5)",
      [userId, amountKobo, note.slice(0, 200), createdBy ?? null, ts(now)],
    );
    return getBalance(tx, userId);
  });
}

export async function listStudentWallets(db: Db): Promise<StudentWallet[]> {
  const rows = await db.query<{ id: number; matric: string; name: string; balance: number }>(
    `SELECT u.id, u.matric, u.name, COALESCE(SUM(l.amount_kobo), 0)::bigint AS balance
     FROM {schema}.users u LEFT JOIN {schema}.ledger l ON l.user_id = u.id
     WHERE u.role = 'student' GROUP BY u.id ORDER BY upper(u.matric)`,
  );
  return rows.map((r) => ({ userId: r.id, matric: r.matric, name: r.name, balanceKobo: Number(r.balance) }));
}
