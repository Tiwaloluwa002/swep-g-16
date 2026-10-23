import type { NextRequest } from "next/server";
import { reissueCode } from "@/lib/server/claims";
import { handle, json, qrDataUrl, readJson, requireUser } from "@/lib/server/http";
import { getDb } from "@/lib/server/store";

/** Issues a fresh handover code; any earlier code stops working. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/claims/[id]/code">) {
  return handle(async () => {
    await readJson(request);
    const user = await requireUser();
    const { id } = await ctx.params;
    const { code, expiresAt } = reissueCode(getDb(), user, id);
    return json({ handoverCode: code, expiresAt, qr: await qrDataUrl(code) });
  });
}
