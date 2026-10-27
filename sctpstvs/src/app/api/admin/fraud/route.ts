import { connection } from "next/server";
import { getDb } from "@/lib/server/context";
import { listFraud } from "@/lib/server/fraud";
import { requireUser } from "@/lib/server/http";
import { FRAUD_LABELS } from "@/lib/labels";
import type { FraudKind } from "@/lib/types";

export async function GET(request: Request) {
  await connection();
  const user = await requireUser(request, ["admin"]);
  if (user instanceof Response) return user;
  const kind = new URL(request.url).searchParams.get("kind");
  const valid = kind && kind in FRAUD_LABELS ? (kind as FraudKind) : undefined;
  return Response.json({ events: await listFraud(await getDb(), { kind: valid }) });
}
