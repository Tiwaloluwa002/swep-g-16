import { connection } from "next/server";
import { handle, json } from "@/lib/server/http";
import { listOpenFound } from "@/lib/server/items";
import { publicFound } from "@/lib/server/serialize";
import { getDb } from "@/lib/server/store";

/** Public board of open found items: generic fields only, readable without signing in. */
export async function GET() {
  await connection();
  return handle(async () => json(listOpenFound(getDb()).slice(0, 50).map(publicFound)));
}
