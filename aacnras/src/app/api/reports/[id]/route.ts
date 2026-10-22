import type { NextRequest } from "next/server";
import { isAdmin, isReportStatus, updateReportStatus } from "@/lib/server/report-store";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/reports/[id]">) {
  if (!isAdmin(request)) return Response.json({ error: "Wrong admin passcode." }, { status: 401 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!isReportStatus(body?.status)) return Response.json({ error: "Invalid status." }, { status: 400 });
  const report = await updateReportStatus(id, body.status);
  if (!report) return Response.json({ error: "Report not found." }, { status: 404 });
  return Response.json(report);
}
