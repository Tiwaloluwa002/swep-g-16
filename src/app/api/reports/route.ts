import { connection } from "next/server";
import { addReport, listReports, parseNewReport } from "@/lib/server/report-store";

export async function GET() {
  await connection();
  return Response.json(await listReports());
}

export async function POST(request: Request) {
  const parsed = parseNewReport(await request.json().catch(() => null));
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });
  return Response.json(await addReport(parsed), { status: 201 });
}
