import { connection } from "next/server";
import { getKeys } from "@/lib/server/context";

/** The public half of the ticket signing key, so anyone can check a ticket's signature offline. */
export async function GET() {
  await connection();
  const keys = getKeys();
  return Response.json({
    algorithm: "Ed25519",
    keyId: keys.keyId,
    publicKey: keys.publicKey.export({ type: "spki", format: "pem" }),
  });
}
