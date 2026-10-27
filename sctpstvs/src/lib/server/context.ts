import path from "node:path";
import { dataDir } from "@/lib/server/db";
import { loadSigningKeys, type SigningKeys } from "@/lib/server/keys";

export { dataDir, getDb } from "@/lib/server/db";

// Kept on globalThis so dev-mode hot reloads reuse one key.
const g = globalThis as unknown as { __sctKeys?: SigningKeys };

export function getKeys(): SigningKeys {
  g.__sctKeys ??= loadSigningKeys(path.join(dataDir(), "keys"));
  return g.__sctKeys;
}
