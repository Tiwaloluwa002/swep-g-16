import { connection } from "next/server";
import { getDb, getKeys } from "@/lib/server/context";
import { handleError, readJson, requireUser } from "@/lib/server/http";
import { listOwnTickets, purchaseTicket } from "@/lib/server/tickets";
import { getBalance } from "@/lib/server/wallet";

export async function GET(request: Request) {
  await connection();
  const user = await requireUser(request, ["student"]);
  if (user instanceof Response) return user;
  return Response.json({ tickets: await listOwnTickets(await getDb(), user.id) });
}

/** Body: { routeId }. Any fare or amount the client sends is ignored; the route's stored fare is charged. */
export async function POST(request: Request) {
  const user = await requireUser(request, ["student"]);
  if (user instanceof Response) return user;
  const { routeId } = await readJson(request);
  try {
    const db = await getDb();
    const ticket = await purchaseTicket(db, getKeys(), user.id, Number(routeId));
    return Response.json({ ticket, balanceKobo: await getBalance(db, user.id) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
