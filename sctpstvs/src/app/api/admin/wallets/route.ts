import { connection } from "next/server";
import { getDb } from "@/lib/server/context";
import { requireUser } from "@/lib/server/http";
import { listStudentWallets } from "@/lib/server/wallet";

export async function GET(request: Request) {
  await connection();
  const user = await requireUser(request, ["admin"]);
  if (user instanceof Response) return user;
  return Response.json({ wallets: await listStudentWallets(await getDb()) });
}
