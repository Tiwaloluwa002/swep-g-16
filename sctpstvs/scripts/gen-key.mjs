// Prints a new Ed25519 ticket signing key for SIGNING_PRIVATE_KEY.
// Paste the one-line value into your host's environment settings. Keep it secret:
// anyone with it can mint tickets. Changing it invalidates every unused ticket.
import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ed25519");
const pem = privateKey.export({ type: "pkcs8", format: "pem" });
const oneLine = Buffer.from(pem).toString("base64");

console.log("# Ticket signing key (Ed25519). Set this as an environment variable; never commit it.");
console.log(`SIGNING_PRIVATE_KEY=${oneLine}`);
console.error("\nThe value is the PKCS8 PEM below, base64-encoded so it survives env-var editors:\n");
console.error(pem);
