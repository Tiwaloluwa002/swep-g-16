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

function fromPrivateKey(privateKey: KeyObject): SigningKeys {
  const publicKey = createPublicKey(privateKey);
  return { privateKey, publicKey, keyId: keyIdOf(publicKey) };
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
  return fromPrivateKey(createPrivateKey(readFileSync(privFile)));
}

/**
 * Reads an Ed25519 private key given as PKCS8 PEM. Hosting dashboards often
 * mangle newlines, so this also accepts the PEM with literal "\n" sequences
 * or the whole PEM base64-encoded on one line (what `npm run gen-key` prints).
 */
export function parsePrivateKey(value: string): SigningKeys {
  let pem = value.trim().replace(/^["']|["']$/g, "");
  if (!pem.includes("-----BEGIN")) pem = Buffer.from(pem, "base64").toString("utf8");
  pem = pem.replace(/\\n/g, "\n");
  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey(pem);
  } catch {
    throw new Error("SIGNING_PRIVATE_KEY is not a valid PKCS8 PEM private key (plain or base64-encoded).");
  }
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("SIGNING_PRIVATE_KEY must be an Ed25519 key.");
  return fromPrivateKey(privateKey);
}

/**
 * The ticket signing key. In production it must come from the
 * SIGNING_PRIVATE_KEY environment variable (it is never stored in the
 * database). In development and tests, without that variable, a key is
 * generated once into dir.
 */
export function loadSigningKeys(dir: string): SigningKeys {
  const fromEnv = process.env.SIGNING_PRIVATE_KEY;
  if (fromEnv?.trim()) return parsePrivateKey(fromEnv);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SIGNING_PRIVATE_KEY is not set. Run `npm run gen-key` and paste the printed value into your host's environment settings.",
    );
  }
  return loadOrCreateSigningKeys(dir);
}
