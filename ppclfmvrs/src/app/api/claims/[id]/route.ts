import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { claimView, getClaim } from "@/lib/server/claims";
import { handle, HttpError, json, requireUser } from "@/lib/server/http";
import { getDb } from "@/lib/server/store";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/claims/[id]">) {
  await connection();
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const db = getDb();
    const claim = getClaim(db, id);
    if (!claim || claim.claimantId !== user.id) throw new HttpError(404, "Claim not found.");
    return json(claimView(db, claim));
  });
}
