import { connection } from "next/server";
import { listVehicles } from "@/lib/server/catalog";
import { getDb } from "@/lib/server/context";
import { requireUser } from "@/lib/server/http";

export async function GET(request: Request) {
  await connection();
  const user = requireUser(request, ["conductor", "admin"]);
  if (user instanceof Response) return user;
  return Response.json({ vehicles: listVehicles(getDb()) });
}
