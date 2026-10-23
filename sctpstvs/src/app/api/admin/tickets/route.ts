import { connection } from "next/server";
import { getDb } from "@/lib/server/context";
import { requireUser } from "@/lib/server/http";
import { listAllTickets, type TicketFilter } from "@/lib/server/tickets";
import { TICKET_STATUS_LABELS } from "@/lib/labels";

/** Query: ?status=active|redeemed|expired|refunded&routeId=1&q=matric-or-code */
export async function GET(request: Request) {
  await connection();
  const user = requireUser(request, ["admin"]);
  if (user instanceof Response) return user;
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const filter: TicketFilter = {
    status: status && status in TICKET_STATUS_LABELS ? (status as TicketFilter["status"]) : undefined,
    routeId: Number(params.get("routeId")) || undefined,
    q: params.get("q")?.slice(0, 60) || undefined,
  };
  return Response.json({ tickets: listAllTickets(getDb(), filter) });
}
