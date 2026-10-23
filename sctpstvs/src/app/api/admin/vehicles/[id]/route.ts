import { setVehicleRoute } from "@/lib/server/catalog";
import { getDb } from "@/lib/server/context";
import { handleError, readJson, requireUser } from "@/lib/server/http";

/** Body: { routeId: number | null } — null lets the vehicle carry any route. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/vehicles/[id]">) {
  const user = requireUser(request, ["admin"]);
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  const body = await readJson(request);
  try {
    return Response.json({ vehicle: setVehicleRoute(getDb(), Number(id), body.routeId ? Number(body.routeId) : null) });
  } catch (err) {
    return handleError(err);
  }
}
