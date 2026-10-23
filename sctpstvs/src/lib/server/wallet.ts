import { type Db, transaction } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import type { LedgerEntry, LedgerKind, StudentWallet } from "@/lib/types";

/** Largest single demo top-up or admin credit: ₦20,000. */
export const MAX_TOPUP_KOBO = 20_000 * 100;

export function getBalance(db: Db, userId: number): number {
  const r = db.prepare("SELECT COALESCE(SUM(amount_kobo), 0) AS balance FROM ledger WHERE user_id = ?").get(userId);
  return Number((r as { balance: number }).balance);
}

export function listLedger(db: Db, userId: number, limit = 50): LedgerEntry[] {
  const rows = db
    .prepare(
      `SELECT id, kind, amount_kobo, note, ticket_id, created_at FROM ledger
       WHERE user_id = ? ORDER BY id DESC LIMIT ?`,
    )
    .all(userId, limit) as {
    id: number;
    kind: LedgerKind;
    amount_kobo: number;
    note: string | null;
    ticket_id: string | null;
    created_at: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    amountKobo: r.amount_kobo,
    note: r.note,
    ticketId: r.ticket_id,
    createdAt: r.created_at,
  }));
}

/** Credits a student's wallet. Used by the demo top-up and by admin credits. */
export function creditWallet(
  db: Db,
  userId: number,
  amountKobo: number,
  { note, createdBy, now = Date.now() }: { note: string; createdBy?: number; now?: number },
): number {
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) throw new AppError("Enter a whole naira amount above zero.");
  if (amountKobo > MAX_TOPUP_KOBO) throw new AppError("A single credit cannot exceed ₦20,000.");
  return transaction(db, () => {
    const user = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as { role: string } | undefined;
    if (!user) throw new AppError("Account not found.", 404);
    if (user.role !== "student") throw new AppError("Only student wallets can be credited.");
    db.prepare(
      "INSERT INTO ledger (user_id, kind, amount_kobo, note, created_by, created_at) VALUES (?, 'topup', ?, ?, ?, ?)",
    ).run(userId, amountKobo, note.slice(0, 200), createdBy ?? null, now);
    return getBalance(db, userId);
  });
}

export function listStudentWallets(db: Db): StudentWallet[] {
  const rows = db
    .prepare(
      `SELECT u.id, u.matric, u.name, COALESCE(SUM(l.amount_kobo), 0) AS balance
       FROM users u LEFT JOIN ledger l ON l.user_id = u.id
       WHERE u.role = 'student' GROUP BY u.id ORDER BY u.matric`,
    )
    .all() as { id: number; matric: string; name: string; balance: number }[];
  return rows.map((r) => ({ userId: r.id, matric: r.matric, name: r.name, balanceKobo: Number(r.balance) }));
}
