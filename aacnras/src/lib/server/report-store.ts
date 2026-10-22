import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { campus } from "@/data/campus";
import { REPORT_STATUSES, REPORT_TYPES } from "@/lib/reports";
import type { Report, ReportStatus, ReportType } from "@/lib/types";

/*
 * Reports live in a JSON file so the project runs with no database.
 * This works for local demos and a single server; move to a real
 * database before deploying to serverless hosting.
 */
const FILE = path.join(process.cwd(), "data", "reports.json");

// Serialise writes so concurrent requests can't overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export async function listReports(): Promise<Report[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Report[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function saveReports(reports: Report[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(reports, null, 2));
  await fs.rename(tmp, FILE);
}

export type NewReport = Pick<Report, "type" | "description" | "edgeId" | "placeId" | "lat" | "lng">;

/** Validates untrusted input; returns an error message or the cleaned report. */
export function parseNewReport(input: unknown): NewReport | string {
  if (typeof input !== "object" || input === null) return "Invalid request body.";
  const body = input as Record<string, unknown>;

  if (typeof body.type !== "string" || !(body.type in REPORT_TYPES)) return "Choose a report type.";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > 500) return "Description must be 500 characters or fewer.";
  const edgeId = typeof body.edgeId === "string" && body.edgeId ? body.edgeId : undefined;
  const placeId = typeof body.placeId === "string" && body.placeId ? body.placeId : undefined;
  if (edgeId && !campus.edges.has(edgeId)) return "Unknown path.";
  if (placeId && !campus.places.has(placeId)) return "Unknown building.";
  if (!edgeId && !placeId) return "Choose the path or building the report is about.";
  const { lat, lng } = body;
  if (typeof lat !== "number" || typeof lng !== "number" || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return "Invalid location.";
  }
  return { type: body.type as ReportType, description, edgeId, placeId, lat, lng };
}

export function addReport(input: NewReport): Promise<Report> {
  return withLock(async () => {
    const now = new Date().toISOString();
    const report: Report = { ...input, id: randomUUID(), status: "pending", createdAt: now, updatedAt: now };
    const reports = await listReports();
    reports.push(report);
    await saveReports(reports);
    return report;
  });
}

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === "string" && value in REPORT_STATUSES;
}

export function updateReportStatus(id: string, status: ReportStatus): Promise<Report | null> {
  return withLock(async () => {
    const reports = await listReports();
    const report = reports.find((r) => r.id === id);
    if (!report) return null;
    report.status = status;
    report.updatedAt = new Date().toISOString();
    await saveReports(reports);
    return report;
  });
}

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE ?? "oau-swep-15";
const digest = (value: string) => createHash("sha256").update(value).digest();

export function isAdmin(request: Request): boolean {
  const given = request.headers.get("x-admin-passcode") ?? "";
  return timingSafeEqual(digest(given), digest(ADMIN_PASSCODE));
}
