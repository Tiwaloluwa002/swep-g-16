import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Point the app at a throwaway database and key before any server module loads:
// in-memory PGlite, or a fresh sct_test_… schema when DATABASE_URL is set.
process.env.SCT_DATA_DIR = mkdtempSync(path.join(tmpdir(), "sct-api-"));
process.env.DATABASE_SCHEMA = `sct_test_api_${process.pid}_${Date.now()}`;

const { POST } = await import("@/app/api/tickets/route");
const { POST: VERIFY } = await import("@/app/api/verify/route");
const { createSession, SESSION_COOKIE } = await import("@/lib/server/auth");
const { getDb } = await import("@/lib/server/context");
const { getBalance } = await import("@/lib/server/wallet");
const { routeId, userId, RICH, CONDUCTOR } = await import("@/lib/server/test-helpers");

async function request(url: string, body: unknown, matric: string) {
  const db = await getDb();
  const token = await createSession(db, await userId(db, matric));
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
    body: JSON.stringify(body),
  });
}

describe("POST /api/tickets", () => {
  let student: number;
  beforeAll(async () => {
    student = await userId(await getDb(), RICH);
  });

  it("charges the server-side route fare, ignoring any amount the client sends", async () => {
    const db = await getDb();
    const route = await routeId(db, "Mozambique Hall – Main Gate"); // ₦250 demo fare
    const before = await getBalance(db, student);
    const res = await POST(await request("/api/tickets", { routeId: route, fareKobo: 1, fareNaira: 1, amount: 1 }, RICH));
    expect(res.status).toBe(201);
    const { ticket } = await res.json();
    expect(ticket.fareKobo).toBe(250_00);
    expect(await getBalance(db, student)).toBe(before - 250_00);
  });

  it("refuses requests without a session and from conductors", async () => {
    const anon = new Request("http://localhost/api/tickets", { method: "POST", body: "{}" });
    expect((await POST(anon)).status).toBe(401);
    expect((await POST(await request("/api/tickets", { routeId: 1 }, CONDUCTOR))).status).toBe(403);
  });

  it("refuses cross-site requests", async () => {
    const req = await request("/api/tickets", { routeId: 1 }, RICH);
    const evil = new Request(req, { headers: { ...Object.fromEntries(req.headers), origin: "https://evil.example", host: "localhost" } });
    expect((await POST(evil)).status).toBe(403);
  });

  it("issues a ticket the verify endpoint accepts exactly once", async () => {
    const route = await routeId(await getDb(), "Main Gate – SUB");
    const res = await POST(await request("/api/tickets", { routeId: route }, RICH));
    const { ticket } = await res.json();
    const first = await (await VERIFY(await request("/api/verify", { code: ticket.token }, CONDUCTOR))).json();
    const second = await (await VERIFY(await request("/api/verify", { code: ticket.token }, CONDUCTOR))).json();
    expect(first.outcome).toBe("valid");
    expect(second.outcome).toBe("already_used");
  });
});
