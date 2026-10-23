import { distanceMetres, getLocation, SIMILAR_COLOURS } from "./catalog";
import { tokenize } from "./text";
import type { Category, MatchScore, ScoreBreakdown } from "./types";

/** The public fields matching is allowed to use. Private details never take part. */
export type LostSide = {
  category: Category;
  colour: string;
  brand: string;
  description: string;
  locationId: string;
  lostDate: string;
};

export type FoundSide = {
  category: Category;
  colour: string;
  description: string;
  locationId: string;
  foundDate: string;
};

export const WEIGHTS: ScoreBreakdown = { colour: 0.25, location: 0.25, date: 0.2, keywords: 0.3 };

/** Candidates below this are not shown to the owner. */
export const SHOW_THRESHOLD = 0.35;
/** Candidates at or above this trigger a notification. */
export const NOTIFY_THRESHOLD = 0.5;

/** Distance at which location stops counting. */
const LOCATION_RANGE_M = 900;
/** Days after the loss at which a find stops counting. */
const DATE_RANGE_DAYS = 14;

const similar = new Set(SIMILAR_COLOURS.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));

export function colourScore(a: string, b: string): number {
  if (a === b) return 1;
  if (a === "multicolour" || b === "multicolour") return 0.3;
  return similar.has(`${a}|${b}`) ? 0.5 : 0;
}

/** 1 for the same place, falling linearly to 0 at 900 m. */
export function locationScore(lostId: string, foundId: string): number {
  if (lostId === foundId) return 1;
  const a = getLocation(lostId);
  const b = getLocation(foundId);
  if (!a || !b) return 0;
  return Math.max(0, 1 - distanceMetres(a, b) / LOCATION_RANGE_M);
}

const DAY_MS = 86_400_000;

/**
 * Found on the day of the loss or the next day scores 1, then decays to 0
 * over two weeks. A find dated one day before the loss gets half credit,
 * because owners often misremember the date; earlier finds cannot match.
 */
export function dateScore(lostDate: string, foundDate: string): number {
  const days = Math.round((Date.parse(foundDate) - Date.parse(lostDate)) / DAY_MS);
  if (Number.isNaN(days) || days < -1) return 0;
  if (days === -1) return 0.5;
  if (days <= 1) return 1;
  return Math.max(0, 1 - (days - 1) / (DATE_RANGE_DAYS - 1));
}

/** Dice overlap of description words: kinder than Jaccard to short, generic finder descriptions. */
export function keywordScore(lostText: string, foundText: string): number {
  const a = tokenize(lostText);
  const b = tokenize(foundText);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return (2 * shared) / (a.size + b.size);
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Scores a lost/found pair from 0 to 1, or null when the categories differ. */
export function scoreMatch(lost: LostSide, found: FoundSide): MatchScore | null {
  if (lost.category !== found.category) return null;
  const breakdown: ScoreBreakdown = {
    colour: round(colourScore(lost.colour, found.colour)),
    location: round(locationScore(lost.locationId, found.locationId)),
    date: round(dateScore(lost.lostDate, found.foundDate)),
    keywords: round(keywordScore(`${lost.brand} ${lost.description}`, found.description)),
  };
  const score =
    breakdown.colour * WEIGHTS.colour +
    breakdown.location * WEIGHTS.location +
    breakdown.date * WEIGHTS.date +
    breakdown.keywords * WEIGHTS.keywords;
  return { score: round(score), breakdown };
}

export type RankedMatch<F> = MatchScore & { found: F };

/** Candidates for one lost report, best first, hiding weak and cross-category pairs. */
export function rankMatches<F extends FoundSide>(
  lost: LostSide,
  found: F[],
  threshold = SHOW_THRESHOLD,
): RankedMatch<F>[] {
  const ranked: RankedMatch<F>[] = [];
  for (const f of found) {
    const m = scoreMatch(lost, f);
    if (m && m.score >= threshold) ranked.push({ ...m, found: f });
  }
  return ranked.sort((x, y) => y.score - x.score || y.found.foundDate.localeCompare(x.found.foundDate));
}
