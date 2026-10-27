import { type Db, ms, ts } from "@/lib/server/db";

/*
 * Sliding-window rate limiter stored in Postgres, so every server instance
 * (or serverless invocation) shares the same counters. Each allowed request
 * is one row in rate_limit_hits; a key's check-and-record runs in one
 * transaction under an advisory lock on that key, so concurrent requests for
 * the same key are counted one at a time.
 */

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
  /** True only on the first refused request in a window, so the fraud log isn't flooded. */
  firstRefusal: boolean;
}

/** Hits older than this are deleted now and then; it must exceed the longest window in LIMITS. */
const RETAIN_MS = 24 * 60 * 60_000;

export async function rateLimit(
  db: Db,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  return db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${tx.schema}:rate:${key}`]);
    await tx.query("DELETE FROM {schema}.rate_limit_hits WHERE key = $1 AND at <= $2", [key, ts(now - windowMs)]);
    const { n, oldest } = await tx.one<{ n: number; oldest: Date | null }>(
      "SELECT COUNT(*) AS n, MIN(at) AS oldest FROM {schema}.rate_limit_hits WHERE key = $1",
      [key],
    );
    // Occasionally sweep keys nobody has used for a day (other keys are pruned on use above).
    if (Math.random() < 0.01) {
      await tx.query("DELETE FROM {schema}.rate_limit_hits WHERE at < $1", [ts(now - RETAIN_MS)]);
    }
    if (n >= limit) {
      const firstRefusal = n === limit;
      // Record one refusal so later ones in this window are not "first" again.
      if (firstRefusal) await tx.query("INSERT INTO {schema}.rate_limit_hits (key, at) VALUES ($1, $2)", [key, ts(now)]);
      const oldestMs = oldest ? ms(oldest) : now;
      return { ok: false, retryAfterMs: Math.max(0, oldestMs + windowMs - now), firstRefusal };
    }
    await tx.query("INSERT INTO {schema}.rate_limit_hits (key, at) VALUES ($1, $2)", [key, ts(now)]);
    return { ok: true, retryAfterMs: 0, firstRefusal: false };
  });
}

export async function resetRateLimit(db: Db, key: string): Promise<void> {
  await db.query("DELETE FROM {schema}.rate_limit_hits WHERE key = $1", [key]);
}

export const LIMITS = {
  /** Sign-in attempts per account and per address. */
  loginAccount: { limit: 5, windowMs: 15 * 60_000 },
  loginIp: { limit: 30, windowMs: 15 * 60_000 },
  /** Verifications per conductor: a busy bus boards a passenger every couple of seconds, not faster. */
  verify: { limit: 30, windowMs: 60_000 },
};
