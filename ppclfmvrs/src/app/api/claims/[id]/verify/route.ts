import type { NextRequest } from "next/server";
import { verifyClaim } from "@/lib/server/claims";
import { handle, json, qrDataUrl, readJson, requireUser } from "@/lib/server/http";
import { getDb } from "@/lib/server/store";

/** Checks the owner's answers. The plain handover code is returned once, here. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/claims/[id]/verify">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await readJson(request)) as { answers?: unknown } | null;
    const result = verifyClaim(getDb(), user, id, body?.answers);
    if (result.outcome !== "verified") return json(result);
    return json({ outcome: result.outcome, handoverCode: result.code, expiresAt: result.expiresAt, qr: await qrDataUrl(result.code) });
  });
}
