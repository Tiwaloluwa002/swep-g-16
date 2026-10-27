import { connection } from "next/server";
import { getDb } from "@/lib/server/context";
import { requireUser } from "@/lib/server/http";
import { getBalance, listLedger } from "@/lib/server/wallet";

export async function GET(request: Request) {
  await connection();
  const user = await requireUser(request, ["student"]);
  if (user instanceof Response) return user;
  const db = await getDb();
  return Response.json({ balanceKobo: await getBalance(db, user.id), ledger: await listLedger(db, user.id) });
}
