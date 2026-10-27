import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { campus } from "@/data/campus";
import { REPORT_STATUSES, REPORT_TYPES } from "@/lib/reports";
import type { Report, ReportStatus, ReportType } from "@/lib/types";
import { query } from "./db";

type ReportRow = {
  id: string;
  type: ReportType;
  description: string;
  edge_id: string | null;
  place_id: string | null;
  lat: number;
  lng: number;
  status: ReportStatus;
  created_at: Date | string;
  updated_at: Date | string;
};

const COLUMNS = "id, type, description, edge_id, place_id, lat, lng, status, created_at, updated_at";
const iso = (value: Date | string) => new Date(value).toISOString();

function toReport(row: ReportRow): Report {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    edgeId: row.edge_id ?? undefined,
    placeId: row.place_id ?? undefined,
    lat: Number(row.lat),
    lng: Number(row.lng),
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export async function listReports(): Promise<Report[]> {
  const rows = await query<ReportRow>(`SELECT ${COLUMNS} FROM {schema}.reports ORDER BY created_at`);
  return rows.map(toReport);
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

export async function addReport(input: NewReport): Promise<Report> {
  const [row] = await query<ReportRow>(
    `INSERT INTO {schema}.reports (id, type, description, edge_id, place_id, lat, lng)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
    [randomUUID(), input.type, input.description, input.edgeId ?? null, input.placeId ?? null, input.lat, input.lng],
  );
  return toReport(row);
}

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === "string" && value in REPORT_STATUSES;
}

export async function updateReportStatus(id: string, status: ReportStatus): Promise<Report | null> {
  const [row] = await query<ReportRow>(
    `UPDATE {schema}.reports SET status = $2, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, status],
  );
  return row ? toReport(row) : null;
}

/** The demo passcode only works outside production; a deployed app must set ADMIN_PASSCODE. */
function adminPasscode(): string {
  const configured = process.env.ADMIN_PASSCODE;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("ADMIN_PASSCODE must be set in production.");
  return "oau-swep-15";
}

const digest = (value: string) => createHash("sha256").update(value).digest();

export function isAdmin(request: Request): boolean {
  const given = request.headers.get("x-admin-passcode") ?? "";
  return timingSafeEqual(digest(given), digest(adminPasscode()));
}
