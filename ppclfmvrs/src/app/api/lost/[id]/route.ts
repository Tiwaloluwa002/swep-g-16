import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { getLost, setLostStatus } from "@/lib/server/items";
import { candidatesFor } from "@/lib/server/matches";
import { ownLost } from "@/lib/server/serialize";
import { getDb } from "@/lib/server/store";

async function ownReport(ctx: RouteContext<"/api/lost/[id]">) {
  const user = await requireUser();
  const { id } = await ctx.params;
  const item = getLost(getDb(), id);
  // Someone else's report is "not found", so ids can't be probed.
  if (!item || item.ownerId !== user.id) throw new HttpError(404, "Lost report not found.");
  return item;
}

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/lost/[id]">) {
  await connection();
  return handle(async () => {
    const item = await ownReport(ctx);
    const candidates = item.status === "open" ? candidatesFor(getDb(), item) : [];
    return json({ item: ownLost(item), candidates }, 200, { allowPrivateDetails: true });
  });
}

/** The owner closes their report, e.g. because they found the item themselves. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/lost/[id]">) {
  return handle(async () => {
    const body = (await readJson(request)) as { status?: unknown } | null;
    const item = await ownReport(ctx);
    if (body?.status !== "closed") throw new HttpError(400, "Only closing a report is supported.");
    if (item.status !== "open") throw new HttpError(409, "This report is already closed.");
    setLostStatus(getDb(), item.id, "closed");
    return json({ ok: true });
  });
}
