import { createVehicle } from "@/lib/server/catalog";
import { getDb } from "@/lib/server/context";
import { handleError, readJson, requireUser } from "@/lib/server/http";

/** Body: { name, routeId: number | null }. Listing uses GET /api/vehicles. */
export async function POST(request: Request) {
  const user = requireUser(request, ["admin"]);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  try {
    const routeId = body.routeId ? Number(body.routeId) : null;
    return Response.json({ vehicle: createVehicle(getDb(), String(body.name ?? ""), routeId) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
