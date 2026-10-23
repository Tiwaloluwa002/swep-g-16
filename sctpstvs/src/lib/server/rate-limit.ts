/*
 * In-memory sliding-window rate limiter. Good enough for one server process;
 * several instances would need a shared store (SQLite or Redis) instead.
 */
const g = globalThis as unknown as { __sctRateLimits?: Map<string, number[]> };
const hits = (g.__sctRateLimits ??= new Map<string, number[]>());

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
  /** True only on the first refused request in a window, so the fraud log isn't flooded. */
  firstRefusal: boolean;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= limit) {
    const firstRefusal = recent.length === limit;
    // Record one refusal so later ones in this window are not "first" again.
    if (firstRefusal) recent.push(now);
    hits.set(key, recent);
    return { ok: false, retryAfterMs: recent[0] + windowMs - now, firstRefusal };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfterMs: 0, firstRefusal: false };
}

export function resetRateLimit(key: string): void {
  hits.delete(key);
}

export const LIMITS = {
  /** Sign-in attempts per account and per address. */
  loginAccount: { limit: 5, windowMs: 15 * 60_000 },
  loginIp: { limit: 30, windowMs: 15 * 60_000 },
  /** Verifications per conductor: a busy bus boards a passenger every couple of seconds, not faster. */
  verify: { limit: 30, windowMs: 60_000 },
};
