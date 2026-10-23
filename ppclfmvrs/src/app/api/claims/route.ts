import { connection } from "next/server";
import { claimView, listClaimsByUser, startClaim } from "@/lib/server/claims";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { getDb } from "@/lib/server/store";

export async function GET() {
  await connection();
  return handle(async () => {
    const user = await requireUser();
    const db = getDb();
    return json(listClaimsByUser(db, user.id).map((c) => claimView(db, c)));
  });
}

/** Starts (or reopens) a claim on a candidate found item. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await readJson(request)) as { lostId?: unknown; foundId?: unknown } | null;
    if (typeof body?.lostId !== "string" || typeof body?.foundId !== "string") throw new HttpError(400, "Choose an item to claim.");
    const db = getDb();
    return json(claimView(db, startClaim(db, user, body.lostId, body.foundId)), 201);
  });
}
