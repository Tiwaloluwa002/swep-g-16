import { getVehicle } from "@/lib/server/catalog";
import { getDb, getKeys } from "@/lib/server/context";
import { logFraud } from "@/lib/server/fraud";
import { clientIp, jsonError, readJson, requireUser } from "@/lib/server/http";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { verifyAndRedeem } from "@/lib/server/tickets";

/** Body: { code, vehicleId? }. code is the scanned QR text or a typed backup code. */
export async function POST(request: Request) {
  const user = await requireUser(request, ["conductor", "admin"]);
  if (user instanceof Response) return user;
  const db = await getDb();
  const ip = clientIp(request);
  const body = await readJson(request);
  const vehicle = body.vehicleId ? await getVehicle(db, Number(body.vehicleId)) : undefined;

  const limit = await rateLimit(db, `verify:${user.id}`, LIMITS.verify.limit, LIMITS.verify.windowMs);
  if (!limit.ok) {
    if (limit.firstRefusal) {
      await logFraud(db, { kind: "rate_limit_verify", actorId: user.id, vehicle: vehicle?.name, ip, detail: "Too many verifications" });
    }
    return jsonError("Too many checks in a minute. Wait a moment and try again.", 429, {
      "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)),
    });
  }

  if (typeof body.code !== "string" || !body.code.trim()) return jsonError("Scan a QR code or type a backup code.", 400);
  if (body.vehicleId && !vehicle) return jsonError("Unknown vehicle.", 400);
  const result = await verifyAndRedeem(db, getKeys(), body.code, { conductorId: user.id, vehicle, ip });
  return Response.json(result);
}
