import { createHash, generateKeyPairSync, type KeyObject, createPrivateKey, createPublicKey } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface SigningKeys {
  privateKey: KeyObject;
  publicKey: KeyObject;
  /** Short fingerprint of the public key, carried in each token so keys can be rotated later. */
  keyId: string;
}

function keyIdOf(publicKey: KeyObject): string {
  const der = publicKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("base64url").slice(0, 8);
}

export function generateSigningKeys(): SigningKeys {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { privateKey, publicKey, keyId: keyIdOf(publicKey) };
}

/** Loads the Ed25519 key pair from dir, creating it on first run. The private key never leaves the server. */
export function loadOrCreateSigningKeys(dir: string): SigningKeys {
  const privFile = path.join(dir, "ticket-signing-key.pem");
  if (!existsSync(privFile)) {
    mkdirSync(dir, { recursive: true });
    const keys = generateSigningKeys();
    const pem = keys.privateKey.export({ type: "pkcs8", format: "pem" });
    // "wx" fails if another process created the key first; we then load theirs.
    try {
      writeFileSync(privFile, pem, { mode: 0o600, flag: "wx" });
      writeFileSync(path.join(dir, "ticket-signing-key.pub.pem"), keys.publicKey.export({ type: "spki", format: "pem" }));
      return keys;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
  }
  const privateKey = createPrivateKey(readFileSync(privFile));
  const publicKey = createPublicKey(privateKey);
  return { privateKey, publicKey, keyId: keyIdOf(publicKey) };
}
