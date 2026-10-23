/** Wrong answers allowed on one claim before it locks. */
export const MAX_ATTEMPTS_PER_CLAIM = 3;
/** Verification attempts one user may make in any 24 hours, across all claims. */
export const MAX_ATTEMPTS_PER_DAY = 5;
export const ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type AttemptCheck = { ok: true } | { ok: false; reason: "claim-locked" | "daily-limit"; message: string };

/**
 * Two limits stop someone fishing for answers: a claim locks after three
 * wrong tries, and a user cannot spread guesses over many claims because
 * the daily cap counts every attempt they make.
 */
export function checkAttempt(claimAttempts: number, userAttemptsInWindow: number): AttemptCheck {
  if (claimAttempts >= MAX_ATTEMPTS_PER_CLAIM) {
    return { ok: false, reason: "claim-locked", message: "This claim is locked after too many wrong answers. Ask the desk for help." };
  }
  if (userAttemptsInWindow >= MAX_ATTEMPTS_PER_DAY) {
    return { ok: false, reason: "daily-limit", message: "You have used all your verification attempts for today. Try again tomorrow." };
  }
  return { ok: true };
}
