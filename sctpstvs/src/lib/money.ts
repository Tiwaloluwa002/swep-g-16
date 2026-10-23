/** Amounts are stored as integer kobo (₦1 = 100 kobo) so sums never drift. */
export const KOBO_PER_NAIRA = 100;

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatNaira(kobo: number): string {
  return naira.format(kobo / KOBO_PER_NAIRA);
}

/** Parses a whole-naira amount typed by a person; returns kobo or null. */
export function nairaToKobo(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) return null;
  return n * KOBO_PER_NAIRA;
}
