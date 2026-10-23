import { connection } from "next/server";
import { getDb } from "@/lib/server/context";
import { requireUser } from "@/lib/server/http";
import { getBalance, listLedger } from "@/lib/server/wallet";

export async function GET(request: Request) {
  await connection();
  const user = requireUser(request, ["student"]);
  if (user instanceof Response) return user;
  const db = getDb();
  return Response.json({ balanceKobo: getBalance(db, user.id), ledger: listLedger(db, user.id) });
}
