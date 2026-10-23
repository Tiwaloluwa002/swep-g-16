import { connection } from "next/server";
import { createRoute, listRoutes, parseRouteInput, type RouteInput } from "@/lib/server/catalog";
import { getDb } from "@/lib/server/context";
import { handleError, jsonError, readJson, requireUser } from "@/lib/server/http";

export async function GET(request: Request) {
  await connection();
  const user = requireUser(request, ["admin"]);
  if (user instanceof Response) return user;
  return Response.json({ routes: listRoutes(getDb(), { includeInactive: true }) });
}

/** Body: { name, origin, destination, fareNaira, active? } */
export async function POST(request: Request) {
  const user = requireUser(request, ["admin"]);
  if (user instanceof Response) return user;
  const input = parseRouteInput(await readJson(request));
  if (typeof input === "string") return jsonError(input, 400);
  try {
    return Response.json({ route: createRoute(getDb(), input as RouteInput) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
