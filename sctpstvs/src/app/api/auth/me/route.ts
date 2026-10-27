import { connection } from "next/server";
import { requireUser } from "@/lib/server/http";

export async function GET(request: Request) {
  await connection();
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return Response.json({ user });
}
