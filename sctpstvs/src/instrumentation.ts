/**
 * Runs once when a server instance starts. In production, check the signing
 * key up front so a missing or malformed SIGNING_PRIVATE_KEY is reported in
 * the server log at boot, not only when the first ticket is bought.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { getKeys } = await import("@/lib/server/context");
  try {
    getKeys();
  } catch (err) {
    console.error(`\n*** Ticket signing is not configured: ${(err as Error).message}\n`);
  }
}
