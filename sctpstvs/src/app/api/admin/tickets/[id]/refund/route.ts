import { getDb } from "@/lib/server/context";
import { handleError, requireUser } from "@/lib/server/http";
import { refundTicket } from "@/lib/server/tickets";

export async function POST(request: Request, ctx: RouteContext<"/api/admin/tickets/[id]/refund">) {
  const user = await requireUser(request, ["admin"]);
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  try {
    return Response.json({ ticket: await refundTicket(await getDb(), id, user.id) });
  } catch (err) {
    return handleError(err);
  }
}
