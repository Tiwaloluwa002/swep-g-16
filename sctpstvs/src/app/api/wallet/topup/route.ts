import { getDb } from "@/lib/server/context";
import { handleError, jsonError, readJson, requireUser } from "@/lib/server/http";
import { creditWallet } from "@/lib/server/wallet";
import { nairaToKobo } from "@/lib/money";

/** DEMO top-up: credits the wallet without any payment. A real system would credit only after a gateway confirms payment. */
export async function POST(request: Request) {
  const user = requireUser(request, ["student"]);
  if (user instanceof Response) return user;
  const amountKobo = nairaToKobo((await readJson(request)).amountNaira);
  if (amountKobo === null) return jsonError("Enter a whole naira amount above zero.", 400);
  try {
    const balanceKobo = creditWallet(getDb(), user.id, amountKobo, { note: "Demo top-up (no real payment)", createdBy: user.id });
    return Response.json({ balanceKobo });
  } catch (err) {
    return handleError(err);
  }
}
