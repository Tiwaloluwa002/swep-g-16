import type { NextRequest } from "next/server";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { getFound, markReceived } from "@/lib/server/items";
import { getDb } from "@/lib/server/store";

/** The desk confirms a finder actually dropped the item off. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/desk/items/[id]/received">) {
  return handle(async () => {
    await readJson(request);
    const user = await requireUser("desk", "admin");
    const { id } = await ctx.params;
    const db = await getDb();
    const item = await getFound(db, id);
    if (!item || item.custody !== "desk" || (user.role === "desk" && item.deskId !== user.deskId)) {
      throw new HttpError(404, "Item not found at your desk.");
    }
    await markReceived(db, item.id);
    return json({ ok: true });
  });
}
