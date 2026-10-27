import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { closeStaleReports } from "@/lib/server/items";
import { getDb } from "@/lib/server/store";

/** Admin housekeeping: closes open reports with no activity for the given number of days. */
export async function POST(request: Request) {
  return handle(async () => {
    await requireUser("admin");
    const body = (await readJson(request)) as { days?: unknown } | null;
    const days = Number(body?.days);
    if (!Number.isInteger(days) || days < 7 || days > 365) throw new HttpError(400, "Choose between 7 and 365 days.");
    return json({ closed: await closeStaleReports(await getDb(), days) });
  });
}
