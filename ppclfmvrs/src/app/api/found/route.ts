import { connection } from "next/server";
import { one } from "@/lib/server/db";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { createFound, listFoundByFinder, listQuestions, parseNewFound } from "@/lib/server/items";
import { matchNewFound } from "@/lib/server/matches";
import { ownFound } from "@/lib/server/serialize";
import { getDb } from "@/lib/server/store";

export async function GET() {
  await connection();
  return handle(async () => {
    const user = await requireUser();
    const db = getDb();
    return json(
      listFoundByFinder(db, user.id).map((item) => {
        const matches = Number(one(db, "SELECT COUNT(*) AS n FROM matches WHERE found_id = ?", item.id)!.n);
        return { ...ownFound(item, listQuestions(db, item.id).map((q) => q.question), item.status === "pending_handover"), matchCount: matches };
      }),
    );
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const parsed = parseNewFound(await readJson(request));
    if (typeof parsed === "string") throw new HttpError(400, parsed);
    const db = getDb();
    const item = createFound(db, user.id, parsed);
    matchNewFound(db, item);
    return json(ownFound(item, parsed.questions.map((q) => q.question), false), 201);
  });
}
