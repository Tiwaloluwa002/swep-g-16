import { connection } from "next/server";
import { listRoutes } from "@/lib/server/catalog";
import { getDb } from "@/lib/server/context";

export async function GET() {
  await connection();
  return Response.json({ routes: listRoutes(getDb()) });
}
