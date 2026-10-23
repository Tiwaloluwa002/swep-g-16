import { connection } from "next/server";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { createLost, listLostByOwner, parseNewLost } from "@/lib/server/items";
import { candidatesFor, matchNewLost } from "@/lib/server/matches";
import { ownLost } from "@/lib/server/serialize";
import { getDb } from "@/lib/server/store";

/** The signed-in user's own lost reports, with how many candidates each has. */
export async function GET() {
  await connection();
  return handle(async () => {
    const user = await requireUser();
    const db = getDb();
    const items = listLostByOwner(db, user.id).map((item) => ({
      ...ownLost(item),
      candidateCount: item.status === "open" ? candidatesFor(db, item).length : 0,
    }));
    return json(items, 200, { allowPrivateDetails: true });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const parsed = parseNewLost(await readJson(request));
    if (typeof parsed === "string") throw new HttpError(400, parsed);
    const db = getDb();
    const item = createLost(db, user.id, parsed);
    matchNewLost(db, item);
    return json(ownLost(item), 201, { allowPrivateDetails: true });
  });
}
