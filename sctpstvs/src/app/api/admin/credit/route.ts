import { getDb } from "@/lib/server/context";
import { handleError, jsonError, readJson, requireUser } from "@/lib/server/http";
import { creditWallet } from "@/lib/server/wallet";
import { nairaToKobo } from "@/lib/money";

/** Body: { matric, amountNaira, note? }. Admin credit, e.g. for cash paid at the transport office. */
export async function POST(request: Request) {
  const admin = requireUser(request, ["admin"]);
  if (admin instanceof Response) return admin;
  const body = await readJson(request);
  const amountKobo = nairaToKobo(body.amountNaira);
  if (amountKobo === null) return jsonError("Enter a whole naira amount above zero.", 400);
  const matric = typeof body.matric === "string" ? body.matric.trim() : "";
  const db = getDb();
  const student = db.prepare("SELECT id FROM users WHERE matric = ?").get(matric) as { id: number } | undefined;
  if (!student) return jsonError("No account has that matric number.", 404);
  const note = typeof body.note === "string" && body.note.trim() ? `Admin credit: ${body.note.trim()}` : "Admin credit";
  try {
    return Response.json({ balanceKobo: creditWallet(db, student.id, amountKobo, { note, createdBy: admin.id }) });
  } catch (err) {
    return handleError(err);
  }
}
