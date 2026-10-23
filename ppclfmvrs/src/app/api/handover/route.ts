import { confirmHandover } from "@/lib/server/claims";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { getDb } from "@/lib/server/store";

/** The desk officer, or the finder for items they hold, accepts a handover code. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await readJson(request)) as { code?: unknown } | null;
    if (typeof body?.code !== "string" || !body.code.trim()) throw new HttpError(400, "Enter the handover code.");
    const result = confirmHandover(getDb(), user, body.code);
    return json({ ok: true, item: result.item, foundId: result.foundId });
  });
}
