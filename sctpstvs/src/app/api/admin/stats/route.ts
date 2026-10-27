import { connection } from "next/server";
import { getDb } from "@/lib/server/context";
import { requireUser } from "@/lib/server/http";
import { adminStats } from "@/lib/server/stats";

export async function GET(request: Request) {
  await connection();
  const user = await requireUser(request, ["admin"]);
  if (user instanceof Response) return user;
  return Response.json(await adminStats(await getDb()));
}
