/** Verification answers are compared after this, so "Blue  Star " matches "blue star". */
export function normalizeAnswer(answer: string): string {
  return answer.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

const STOPWORDS = new Set(
  (
    "a an and the of on in at to for from with by near my its it is was were has have had this that " +
    "some one two very small big large little old new item thing found lost left side colour color " +
    "inside outside around about"
  ).split(" "),
);

/** Lowercase word tokens with stopwords removed and a light plural strip ("keys" -> "key"). */
export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of text.toLowerCase().normalize("NFKC").split(/[^a-z0-9]+/)) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue;
    const word = raw.length > 3 && raw.endsWith("s") && !raw.endsWith("ss") ? raw.slice(0, -1) : raw;
    tokens.add(word);
  }
  return tokens;
}

export type SensitiveFinding = "email" | "phone" | "long-number" | "matric-number";

const SENSITIVE_PATTERNS: [SensitiveFinding, RegExp][] = [
  ["email", /[^\s@]+@[^\s@]+\.[^\s@]+/],
  ["phone", /(\+?234|\b0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b/],
  ["matric-number", /\b[a-z]{2,4}\/\d{2,4}\/\d{2,5}\b/i],
  ["long-number", /\d{5,}/],
];

export const SENSITIVE_MESSAGES: Record<SensitiveFinding, string> = {
  email: "Remove the email address.",
  phone: "Remove the phone number.",
  "matric-number": "Remove the matriculation or staff number.",
  "long-number": "Remove long numbers such as serial, IMEI or card numbers.",
};

/**
 * Public text must not carry details that identify the owner or let someone
 * fake a claim. Returns what was found, so the form can say what to remove.
 */
export function findSensitiveText(text: string): SensitiveFinding[] {
  return SENSITIVE_PATTERNS.filter(([, re]) => re.test(text)).map(([kind]) => kind);
}
