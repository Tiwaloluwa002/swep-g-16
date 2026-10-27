import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { getFound, listQuestions, setFoundStatus } from "@/lib/server/items";
import { ownFound } from "@/lib/server/serialize";
import { getDb } from "@/lib/server/store";
import type { User } from "@/lib/types";

function canManage(user: User, finderId: string, deskId: string | null) {
  return user.id === finderId || user.role === "admin" || (user.role === "desk" && user.deskId === deskId);
}

async function managedItem(ctx: RouteContext<"/api/found/[id]">) {
  const user = await requireUser();
  const { id } = await ctx.params;
  const item = await getFound(await getDb(), id);
  if (!item || !canManage(user, item.finderId, item.deskId)) throw new HttpError(404, "Found report not found.");
  return item;
}

/** The finder's (or holding desk's) view of a found report. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/found/[id]">) {
  await connection();
  return handle(async () => {
    const item = await managedItem(ctx);
    const questions = (await listQuestions(await getDb(), item.id)).map((q) => q.question);
    return json(ownFound(item, questions, item.status === "pending_handover"));
  });
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/found/[id]">) {
  return handle(async () => {
    const body = (await readJson(request)) as { status?: unknown } | null;
    const item = await managedItem(ctx);
    if (body?.status !== "closed") throw new HttpError(400, "Only closing a report is supported.");
    if (item.status !== "open") throw new HttpError(409, "Only an open report can be closed.");
    await setFoundStatus(await getDb(), item.id, "closed");
    return json({ ok: true });
  });
}
