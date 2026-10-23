import { parseRouteInput, updateRoute } from "@/lib/server/catalog";
import { getDb } from "@/lib/server/context";
import { handleError, jsonError, readJson, requireUser } from "@/lib/server/http";

/** Body: any of { name, origin, destination, fareNaira, active }. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/routes/[id]">) {
  const user = requireUser(request, ["admin"]);
  if (user instanceof Response) return user;
  const input = parseRouteInput(await readJson(request), true);
  if (typeof input === "string") return jsonError(input, 400);
  const { id } = await ctx.params;
  try {
    return Response.json({ route: updateRoute(getDb(), Number(id), input) });
  } catch (err) {
    return handleError(err);
  }
}
