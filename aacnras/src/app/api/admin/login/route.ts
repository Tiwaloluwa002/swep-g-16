import { isAdmin } from "@/lib/server/report-store";

export async function POST(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "Wrong admin passcode." }, { status: 401 });
  return Response.json({ ok: true });
}
