import { connection } from "next/server";
import { count } from "@/lib/server/db";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { createFound, listFoundByFinder, listQuestions, parseNewFound } from "@/lib/server/items";
import { matchNewFound } from "@/lib/server/matches";
import { ownFound } from "@/lib/server/serialize";
import { getDb } from "@/lib/server/store";

export async function GET() {
  await connection();
  return handle(async () => {
    const user = await requireUser();
    const db = await getDb();
    const items = [];
    for (const item of await listFoundByFinder(db, user.id)) {
      const matchCount = await count(db, "SELECT COUNT(*)::int AS n FROM {schema}.matches WHERE found_id = $1", item.id);
      const questions = (await listQuestions(db, item.id)).map((q) => q.question);
      items.push({ ...ownFound(item, questions, item.status === "pending_handover"), matchCount });
    }
    return json(items);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const parsed = parseNewFound(await readJson(request));
    if (typeof parsed === "string") throw new HttpError(400, parsed);
    const db = await getDb();
    const item = await createFound(db, user.id, parsed);
    await matchNewFound(db, item);
    return json(ownFound(item, parsed.questions.map((q) => q.question), false), 201);
  });
}
